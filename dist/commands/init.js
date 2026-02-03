import * as fs from 'fs';
import ora from 'ora';
import { configManager } from '../core/config-manager.js';
import { logger } from '../utils/logger.js';
import { promptProjectName, promptEnvironment, promptConfirm } from '../utils/prompt.js';
import { createTemplate, updateGitignore, getDirectoryName } from '../utils/env-parser.js';
/**
 * Initialize a new envman project
 */
export async function initCommand(projectNameArg) {
    try {
        // Check if already initialized
        if (configManager.projectExists()) {
            logger.warn('Project is already initialized at .envman/config.json');
            const override = await promptConfirm('Do you want to reinitialize?');
            if (!override) {
                logger.info('Initialization cancelled');
                return;
            }
        }
        logger.header('🚀 Initializing EnvMan Project');
        // Get project name
        const defaultName = getDirectoryName();
        const projectName = projectNameArg || (await promptProjectName(defaultName));
        // Get default environment
        const environment = await promptEnvironment('development');
        // Check if should scan codebase
        const shouldScan = await promptConfirm('Scan codebase for existing environment variables?');
        const spinner = ora('Setting up project...').start();
        try {
            // Create .env.template if .env exists
            if (fs.existsSync('.env')) {
                createTemplate('.env', '.env.template');
                spinner.text = 'Created .env.template';
            }
            // Update .gitignore
            updateGitignore('.gitignore', ['.env', '.envman/credentials']);
            spinner.text = 'Updated .gitignore';
            // Create project config
            const config = {
                projectName,
                defaultEnvironment: environment,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                environments: ['development', 'staging', 'production']
            };
            configManager.initProject(config);
            spinner.succeed('Project initialized!');
            logger.blank();
            logger.success(`✓ Project "${projectName}" initialized`);
            logger.info(`Environment: ${environment}`);
            logger.info(`Config: .envman/config.json`);
            logger.blank();
            logger.header('📝 Next Steps');
            logger.highlight('1. Run: envman login');
            logger.highlight('2. Run: envman push');
            logger.highlight('3. Share .env.template with your team');
        }
        catch (error) {
            spinner.fail('Failed to initialize project');
            throw error;
        }
    }
    catch (error) {
        logger.error(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
    }
}
/**
 * Register init command with Commander
 */
export function registerInitCommand(program) {
    program
        .command('init [project-name]')
        .description('Initialize a new envman project')
        .action(initCommand);
}
//# sourceMappingURL=init.js.map