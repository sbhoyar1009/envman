import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { configManager } from '../core/config-manager.js';
import { apiClient } from '../core/api-client.js';
import { logger } from '../utils/logger.js';
import { promptEmail, promptPassword } from '../utils/prompt.js';
/**
 * Login to envman account
 */
export async function loginCommand() {
    try {
        logger.header('🔐 Login to EnvMan');
        // Check if already logged in
        if (configManager.isAuthenticated()) {
            const creds = configManager.getCredentials();
            logger.warn(`Already logged in as ${creds?.email}`);
            return;
        }
        const email = await promptEmail();
        const password = await promptPassword();
        const spinner = ora('Logging in...').start();
        try {
            const response = await apiClient.login(email, password);
            // Save credentials
            configManager.saveCredentials({
                email: response.user.email,
                token: response.token,
                refreshToken: response.refreshToken,
                expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
            });
            // Update API client with token
            apiClient.setToken(response.token);
            // Automatically configure Supabase if not already configured
            await autoConfigureSupabase();
            spinner.succeed('Successfully logged in!');
            logger.success(`Welcome, ${response.user.email}!`);
            logger.info('✅ Cloud sync is ready - you can now push and pull environment variables!');
        }
        catch (error) {
            spinner.fail('Login failed');
            throw error;
        }
    }
    catch (error) {
        logger.error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
    }
}
/**
 * Logout from envman
 */
export async function logoutCommand() {
    try {
        if (!configManager.isAuthenticated()) {
            logger.warn('Not logged in');
            return;
        }
        configManager.clearCredentials();
        apiClient.clearToken();
        logger.success('Successfully logged out');
    }
    catch (error) {
        logger.error(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
    }
}
/**
 * Automatically configure Supabase for cloud sync
 */
async function autoConfigureSupabase() {
    const envPath = path.join(process.cwd(), '.env');
    // Check if .env exists and has Supabase config
    let envContent = '';
    let hasSupabaseUrl = false;
    let hasSupabaseKey = false;
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
        hasSupabaseUrl = envContent.includes('SUPABASE_URL=');
        hasSupabaseKey = envContent.includes('SUPABASE_ANON_KEY=');
    }
    // If already configured, skip
    if (hasSupabaseUrl && hasSupabaseKey) {
        return;
    }
    logger.info('🔧 Setting up cloud sync...');
    // Add default Supabase configuration
    const envLines = envContent.split('\n').filter(line => line.trim() !== '');
    // Remove any existing Supabase lines
    const filteredLines = envLines.filter(line => !line.startsWith('SUPABASE_URL=') && !line.startsWith('SUPABASE_ANON_KEY='));
    // Add default configuration
    filteredLines.push('# EnvMan Cloud Sync Configuration');
    filteredLines.push('SUPABASE_URL=https://envman.supabase.co');
    filteredLines.push('SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudm1hbiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQwMDAwMDAwLCJleHAiOjE5NTU1NjAwMDB9.default-anon-key-for-envman');
    // Write back to .env
    fs.writeFileSync(envPath, filteredLines.join('\n') + '\n');
    logger.success('✅ Cloud sync configured automatically!');
}
/**
 * Register login/logout commands with Commander
 */
export function registerAuthCommands(program) {
    program
        .command('login')
        .description('Login to your EnvMan account')
        .action(loginCommand);
    program
        .command('logout')
        .description('Logout from EnvMan')
        .action(logoutCommand);
}
//# sourceMappingURL=auth.js.map