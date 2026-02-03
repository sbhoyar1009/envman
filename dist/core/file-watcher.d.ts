import { EventEmitter } from 'events';
/**
 * File change information
 */
export interface FileChangeInfo {
    type: 'added' | 'changed' | 'deleted';
    path: string;
    timestamp: Date;
    content?: string;
}
/**
 * Environment variable change information
 */
export interface EnvChangeInfo {
    type: 'added' | 'modified' | 'removed';
    variables: {
        added: string[];
        modified: string[];
        removed: string[];
    };
    timestamp: Date;
}
/**
 * File watcher for monitoring .env files
 */
export declare class FileWatcher extends EventEmitter {
    private watcher;
    private debounceTimer;
    private lastContent;
    private readonly debounceDelay;
    /**
     * Start watching a file
     */
    watch(filePath: string): void;
    /**
     * Stop watching
     */
    stop(): void;
    /**
     * Handle file change with debouncing
     */
    private handleFileChange;
    /**
     * Process the actual file change
     */
    private processFileChange;
    /**
     * Calculate what changed between two .env file contents
     */
    private calculateChanges;
    /**
     * Parse .env file content into key-value pairs
     */
    private parseEnvContent;
    /**
     * Get current file hash for comparison
     */
    getFileHash(filePath: string): string;
}
//# sourceMappingURL=file-watcher.d.ts.map