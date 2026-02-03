import * as fs from 'fs';
import * as path from 'path';
import Conf from 'conf';
import { logger } from '../utils/logger.js';
/**
 * Manages project and user configuration
 */
export class ConfigManager {
    constructor() {
        this.envmanDir = path.join(process.cwd(), '.envman');
        this.projectConfigPath = path.join(this.envmanDir, 'config.json');
        this.userConfig = new Conf({
            projectName: 'envman',
            cwd: path.join(process.env.HOME || '.', '.config')
        });
    }
    /**
     * Check if project is already initialized
     */
    projectExists() {
        return fs.existsSync(this.projectConfigPath);
    }
    /**
     * Initialize new project configuration
     */
    initProject(config) {
        if (!fs.existsSync(this.envmanDir)) {
            fs.mkdirSync(this.envmanDir, { recursive: true });
        }
        fs.writeFileSync(this.projectConfigPath, JSON.stringify(config, null, 2), 'utf-8');
        logger.success(`Project initialized at ${this.envmanDir}`);
    }
    /**
     * Load project configuration
     */
    loadProject() {
        if (!this.projectExists()) {
            return null;
        }
        try {
            const content = fs.readFileSync(this.projectConfigPath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            logger.error('Failed to load project configuration');
            return null;
        }
    }
    /**
     * Save user credentials
     */
    saveCredentials(credentials) {
        this.userConfig.set('email', credentials.email);
        this.userConfig.set('token', credentials.token);
        this.userConfig.set('refreshToken', credentials.refreshToken);
        this.userConfig.set('expiresAt', credentials.expiresAt);
    }
    /**
     * Get saved credentials
     */
    getCredentials() {
        try {
            const email = this.userConfig.get('email');
            const token = this.userConfig.get('token');
            const refreshToken = this.userConfig.get('refreshToken');
            const expiresAt = this.userConfig.get('expiresAt');
            if (!email || !token) {
                return null;
            }
            return {
                email,
                token,
                refreshToken: refreshToken || '',
                expiresAt: expiresAt || 0
            };
        }
        catch {
            return null;
        }
    }
    /**
     * Clear credentials (logout)
     */
    clearCredentials() {
        this.userConfig.clear();
        logger.success('Logged out successfully');
    }
    /**
     * Update project configuration
     */
    updateProject(updates) {
        const current = this.loadProject();
        if (!current) {
            logger.error('Project not found');
            return;
        }
        const updated = { ...current, ...updates, lastUpdated: new Date().toISOString() };
        fs.writeFileSync(this.projectConfigPath, JSON.stringify(updated, null, 2), 'utf-8');
    }
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        const creds = this.getCredentials();
        if (!creds)
            return false;
        // Check if token is expired
        if (creds.expiresAt && creds.expiresAt < Date.now()) {
            this.clearCredentials();
            return false;
        }
        return true;
    }
    /**
     * Get envman directory path
     */
    getEnvmanDir() {
        return this.envmanDir;
    }
    /**
     * Get credentials file path
     */
    getCredentialsPath() {
        return path.join(this.envmanDir, 'credentials');
    }
    /**
     * Check if user has required permission
     */
    async hasPermission(permission) {
        const creds = this.getCredentials();
        if (!creds)
            return false;
        const project = this.loadProject();
        if (!project)
            return false;
        // Special case: allow 'write' permission for first push (when project doesn't exist yet)
        if (permission === 'write') {
            // Import API client here to avoid circular dependency
            const { APIClient } = await import('./api-client.js');
            const client = new APIClient('https://api.envman.dev', creds.token);
            try {
                // Check if project exists
                const exists = await client.projectExists(project.projectName);
                // If project doesn't exist, allow write permission for first push
                if (!exists) {
                    return true;
                }
            }
            catch (error) {
                // If we can't check, assume no permission
                return false;
            }
        }
        // Import API client here to avoid circular dependency
        const { APIClient } = await import('./api-client.js');
        const client = new APIClient('https://api.envman.dev', creds.token);
        try {
            const permissions = await client.getUserPermissions(project.projectName, creds.email);
            return permissions.includes(permission);
        }
        catch (error) {
            logger.warn('Could not verify permissions, assuming no access');
            return false;
        }
    }
    /**
     * Check if user has any of the required permissions
     */
    async hasAnyPermission(permissions) {
        for (const permission of permissions) {
            if (await this.hasPermission(permission)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Enforce permission check - throws error if not authorized
     */
    async requirePermission(permission, operation = 'perform this operation') {
        if (!(await this.hasPermission(permission))) {
            logger.error(`Permission denied: You don't have permission to ${operation}`);
            logger.info(`Required permission: ${permission}`);
            process.exit(1);
        }
    }
    /**
     * Enforce any of the permissions - throws error if none authorized
     */
    async requireAnyPermission(permissions, operation = 'perform this operation') {
        if (!(await this.hasAnyPermission(permissions))) {
            logger.error(`Permission denied: You don't have permission to ${operation}`);
            logger.info(`Required permissions: ${permissions.join(' or ')}`);
            process.exit(1);
        }
    }
}
export const configManager = new ConfigManager();
//# sourceMappingURL=config-manager.js.map