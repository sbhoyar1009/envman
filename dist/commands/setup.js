import * as fs from 'fs';
import inquirer from 'inquirer';
import { logger } from '../utils/logger.js';
/**
 * Setup cloud sync configuration
 */
export async function setupCommand(options) {
    try {
        logger.header('🚀 EnvMan Cloud Sync Setup');
        // Check if .env already exists
        const envPath = '.env';
        let envExists = fs.existsSync(envPath);
        let envContent = '';
        if (envExists) {
            envContent = fs.readFileSync(envPath, 'utf-8');
            logger.info('Found existing .env file');
        }
        // Get Supabase URL
        let supabaseUrl = options.supabaseUrl;
        if (!supabaseUrl) {
            const { url } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'url',
                    message: 'Enter your Supabase project URL:',
                    validate: (input) => {
                        if (!input)
                            return 'Supabase URL is required';
                        if (!input.startsWith('https://'))
                            return 'URL must start with https://';
                        if (!input.includes('.supabase.co'))
                            return 'URL must be a valid Supabase URL';
                        return true;
                    }
                }
            ]);
            supabaseUrl = url;
        }
        // Get Supabase anon key
        let supabaseKey = options.supabaseKey;
        if (!supabaseKey) {
            const { key } = await inquirer.prompt([
                {
                    type: 'password',
                    name: 'key',
                    message: 'Enter your Supabase anon key:',
                    mask: '*',
                    validate: (input) => {
                        if (!input)
                            return 'Supabase anon key is required';
                        if (input.length < 100)
                            return 'Anon key seems too short';
                        return true;
                    }
                }
            ]);
            supabaseKey = key;
        }
        // Update .env file
        const envLines = envContent.split('\n').filter(line => !line.startsWith('SUPABASE_'));
        envLines.push(`SUPABASE_URL=${supabaseUrl}`);
        envLines.push(`SUPABASE_ANON_KEY=${supabaseKey}`);
        fs.writeFileSync(envPath, envLines.join('\n'));
        logger.success('✓ Updated .env with Supabase configuration');
        // Check database schema
        logger.info('');
        logger.info('📋 Next steps:');
        logger.info('1. Go to your Supabase dashboard SQL editor');
        logger.info('2. Run the SQL from database-schema.sql');
        logger.info('3. Test the connection with: envman login');
        logger.info('');
        logger.info('💡 Your data will be encrypted before leaving your machine!');
    }
    catch (error) {
        logger.error(`Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
    }
}
/**
 * Register setup command with Commander
 */
export function registerSetupCommand(program) {
    program
        .command('setup')
        .description('Configure cloud sync with Supabase')
        .option('--supabase-url <url>', 'Supabase project URL')
        .option('--supabase-key <key>', 'Supabase anon key')
        .action(setupCommand);
}
//# sourceMappingURL=setup.js.map