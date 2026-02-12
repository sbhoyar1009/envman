import ora from 'ora';
import * as fs from 'fs';
import { configManager } from '../core/config-manager.js';
import { apiClient } from '../core/api-client.js';
import { EncryptionManager } from '../core/encryption.js';
import { logger } from '../utils/logger.js';
import { parseEnvFile } from '../utils/env-parser.js';
import { promptChoice } from '../utils/prompt.js';
/**
 * Compare local environment variables with remote
 */
export async function diffCommand(options) {
    try {
        // Check authentication
        if (!configManager.isAuthenticated()) {
            logger.error('Not authenticated. Please run: envman login');
            process.exit(1);
        }
        // Get and set user credentials to API client
        const credentials = configManager.getCredentials();
        if (!credentials) {
            logger.error('Failed to retrieve credentials');
            process.exit(1);
        }
        apiClient.setToken(credentials.token, credentials.refreshToken);
        // Check project initialization
        const projectConfig = configManager.loadProject();
        if (!projectConfig) {
            logger.error('Project not initialized. Please run: envman init');
            process.exit(1);
        }
        logger.header('🔍 Comparing Environment Variables');
        // Get environment
        const environment = options.env || (await promptChoice('Select environment to compare:', projectConfig.environments));
        // Get file to compare (default .env)
        const filePath = options.file || '.env';
        // Check if local file exists
        if (!fs.existsSync(filePath)) {
            logger.error(`Local file '${filePath}' does not exist`);
            process.exit(1);
        }
        const spinner = ora('Fetching remote variables...').start();
        try {
            // Fetch remote variables
            const response = await apiClient.pullVariables(projectConfig.projectName, environment);
            if (!response.success || !response.data) {
                throw new Error(response.message || 'Failed to fetch remote variables');
            }
            spinner.text = 'Decrypting remote variables...';
            // Decrypt remote variables
            const encryption = new EncryptionManager(projectConfig.projectName);
            const remoteVars = encryption.decryptVariables(response.data);
            spinner.text = 'Comparing with local file...';
            // Parse local file
            const localVars = parseEnvFile(filePath);
            // Calculate diff
            const diff = calculateDiff(localVars, remoteVars);
            spinner.succeed('Comparison complete!');
            // Display results
            displayDiff(diff, filePath, environment);
        }
        catch (error) {
            spinner.fail('Failed to compare environments');
            throw error;
        }
    }
    catch (error) {
        logger.error(`Diff failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
    }
}
/**
 * Calculate differences between two sets of variables
 */
function calculateDiff(local, remote) {
    const added = [];
    const removed = [];
    const modified = [];
    // Find added and modified
    for (const [key, value] of Object.entries(remote)) {
        if (!(key in local)) {
            added.push(key);
        }
        else if (local[key] !== value) {
            modified.push({
                key,
                oldValue: local[key],
                newValue: value
            });
        }
    }
    // Find removed
    for (const key of Object.keys(local)) {
        if (!(key in remote)) {
            removed.push(key);
        }
    }
    return { added, removed, modified };
}
/**
 * Display diff results in a readable format
 */
function displayDiff(diff, localFile, environment) {
    logger.blank();
    logger.highlight(`📊 Environment Comparison:`);
    logger.info(`Local: ${localFile}`);
    logger.info(`Remote: ${environment}`);
    logger.blank();
    if (diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0) {
        logger.success('✅ Environments are in sync!');
        return;
    }
    if (diff.added.length > 0) {
        logger.warn(`➕ Added in remote (${diff.added.length}):`);
        diff.added.forEach(key => logger.info(`  ${key}`));
        logger.blank();
    }
    if (diff.removed.length > 0) {
        logger.error(`➖ Removed from remote (${diff.removed.length}):`);
        diff.removed.forEach(key => logger.info(`  ${key}`));
        logger.blank();
    }
    if (diff.modified.length > 0) {
        logger.info(`✏️  Modified (${diff.modified.length}):`);
        diff.modified.forEach(({ key, oldValue, newValue }) => {
            logger.info(`  ${key}:`);
            logger.dim(`    Local:  ${oldValue}`);
            logger.dim(`    Remote: ${newValue}`);
        });
        logger.blank();
    }
    logger.highlight('💡 To sync local with remote, run: envman pull -e ' + environment);
}
/**
 * Register diff command with Commander
 */
export function registerDiffCommand(program) {
    program
        .command('diff')
        .option('-e, --env <environment>', 'Environment to compare against')
        .option('-f, --file <file>', 'Local file to compare (default: .env)')
        .description('Compare local environment variables with remote')
        .action(diffCommand);
}
//# sourceMappingURL=diff.js.map