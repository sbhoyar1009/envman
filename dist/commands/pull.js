import ora from 'ora';
import * as fs from 'fs';
import { configManager } from '../core/config-manager.js';
import { apiClient } from '../core/api-client.js';
import { EncryptionManager } from '../core/encryption.js';
import { logger } from '../utils/logger.js';
import { writeEnvFile } from '../utils/env-parser.js';
import { promptConfirm, promptChoice } from '../utils/prompt.js';
/**
 * Pull and decrypt environment variables from cloud
 */
export async function pullCommand(options) {
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
        // Check permissions
        await configManager.requirePermission('read', 'pull environment variables');
        logger.header('📥 Pulling Environment Variables');
        // Check if .env already exists
        if (fs.existsSync('.env') && !options.force) {
            const confirm = await promptConfirm('.env already exists. Overwrite?');
            if (!confirm) {
                logger.info('Pull cancelled');
                return;
            }
        }
        // Get environment
        const environment = options.env || (await promptChoice('Select environment:', projectConfig.environments));
        const spinner = ora('Fetching variables from server...').start();
        try {
            // Fetch from server
            const response = await apiClient.pullVariables(projectConfig.projectName, environment);
            if (!response.success || !response.data) {
                throw new Error(response.message || 'Failed to fetch variables');
            }
            spinner.text = `Decrypting ${response.data.length} variables...`;
            // Decrypt variables
            const encryption = new EncryptionManager(projectConfig.projectName);
            const decrypted = encryption.decryptVariables(response.data);
            // Write to .env
            writeEnvFile('.env', decrypted);
            spinner.succeed('Variables pulled successfully!');
            logger.blank();
            logger.highlight(`📊 Summary:`);
            logger.info(`Total variables: ${response.data.length}`);
            logger.info(`Environment: ${environment}`);
            logger.info(`File: .env`);
            logger.blank();
            logger.success('Your .env file has been updated');
        }
        catch (error) {
            spinner.fail('Failed to pull variables');
            throw error;
        }
    }
    catch (error) {
        logger.error(`Pull failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
    }
}
/**
 * Register pull command with Commander
 */
export function registerPullCommand(program) {
    program
        .command('pull')
        .option('-e, --env <environment>', 'Environment to pull from')
        .option('-f, --force', 'Skip confirmations')
        .description('Download and decrypt environment variables')
        .action(pullCommand);
}
//# sourceMappingURL=pull.js.map