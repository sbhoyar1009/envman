import { ProjectConfig, UserCredentials } from '../types/index.js';
/**
 * Manages project and user configuration
 */
export declare class ConfigManager {
    private projectConfigPath;
    private userConfig;
    private envmanDir;
    constructor();
    /**
     * Check if project is already initialized
     */
    projectExists(): boolean;
    /**
     * Initialize new project configuration
     */
    initProject(config: ProjectConfig): void;
    /**
     * Load project configuration
     */
    loadProject(): ProjectConfig | null;
    /**
     * Save user credentials
     */
    saveCredentials(credentials: UserCredentials): void;
    /**
     * Get saved credentials
     */
    getCredentials(): UserCredentials | null;
    /**
     * Clear credentials (logout)
     */
    clearCredentials(): void;
    /**
     * Update project configuration
     */
    updateProject(updates: Partial<ProjectConfig>): void;
    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean;
    /**
     * Get envman directory path
     */
    getEnvmanDir(): string;
    /**
     * Get credentials file path
     */
    getCredentialsPath(): string;
    /**
     * Check if user has required permission
     */
    hasPermission(permission: string): Promise<boolean>;
    /**
     * Check if user has any of the required permissions
     */
    hasAnyPermission(permissions: string[]): Promise<boolean>;
    /**
     * Enforce permission check - throws error if not authorized
     */
    requirePermission(permission: string, operation?: string): Promise<void>;
    /**
     * Enforce any of the permissions - throws error if none authorized
     */
    requireAnyPermission(permissions: string[], operation?: string): Promise<void>;
}
export declare const configManager: ConfigManager;
//# sourceMappingURL=config-manager.d.ts.map