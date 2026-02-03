import * as fs from 'fs';
import { EventEmitter } from 'events';
import chokidar from 'chokidar';
import { logger } from '../utils/logger.js';
/**
 * File watcher for monitoring .env files
 */
export class FileWatcher extends EventEmitter {
    constructor() {
        super(...arguments);
        this.watcher = null;
        this.debounceTimer = null;
        this.lastContent = '';
        this.debounceDelay = 2000; // 2 seconds
    }
    /**
     * Start watching a file
     */
    watch(filePath) {
        if (this.watcher) {
            this.stop();
        }
        logger.debug(`Starting file watcher for: ${filePath}`);
        // Read initial content
        try {
            this.lastContent = fs.readFileSync(filePath, 'utf-8');
        }
        catch (error) {
            logger.warn(`Could not read initial file content: ${filePath}`);
            this.lastContent = '';
        }
        // Start watching
        this.watcher = chokidar.watch(filePath, {
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 1000,
                pollInterval: 100
            }
        });
        this.watcher.on('change', (path) => {
            logger.debug(`File change detected: ${path}`);
            this.handleFileChange(path);
        });
        this.watcher.on('error', (error) => {
            logger.error(`File watcher error: ${error.message}`);
            this.emit('error', error);
        });
        this.emit('started', filePath);
    }
    /**
     * Stop watching
     */
    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
            logger.debug('File watcher stopped');
            this.emit('stopped');
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }
    /**
     * Handle file change with debouncing
     */
    handleFileChange(filePath) {
        // Clear existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        // Set new timer
        this.debounceTimer = setTimeout(() => {
            this.processFileChange(filePath);
        }, this.debounceDelay);
    }
    /**
     * Process the actual file change
     */
    processFileChange(filePath) {
        try {
            const newContent = fs.readFileSync(filePath, 'utf-8');
            const changes = this.calculateChanges(this.lastContent, newContent);
            if (changes.variables.added.length > 0 ||
                changes.variables.modified.length > 0 ||
                changes.variables.removed.length > 0) {
                logger.debug(`Environment variables changed: +${changes.variables.added.length} -${changes.variables.removed.length} ~${changes.variables.modified.length}`);
                this.lastContent = newContent;
                this.emit('env-changed', changes);
            }
        }
        catch (error) {
            logger.error(`Error processing file change: ${error}`);
            this.emit('error', error);
        }
    }
    /**
     * Calculate what changed between two .env file contents
     */
    calculateChanges(oldContent, newContent) {
        const oldVars = this.parseEnvContent(oldContent);
        const newVars = this.parseEnvContent(newContent);
        const added = [];
        const modified = [];
        const removed = [];
        // Find added and modified
        for (const [key, value] of Object.entries(newVars)) {
            if (!(key in oldVars)) {
                added.push(key);
            }
            else if (oldVars[key] !== value) {
                modified.push(key);
            }
        }
        // Find removed
        for (const key of Object.keys(oldVars)) {
            if (!(key in newVars)) {
                removed.push(key);
            }
        }
        return {
            type: added.length > 0 || removed.length > 0 ? 'modified' : 'added',
            variables: { added, modified, removed },
            timestamp: new Date()
        };
    }
    /**
     * Parse .env file content into key-value pairs
     */
    parseEnvContent(content) {
        const vars = {};
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key) {
                    vars[key.trim()] = valueParts.join('=').trim();
                }
            }
        });
        return vars;
    }
    /**
     * Get current file hash for comparison
     */
    getFileHash(filePath) {
        try {
            const crypto = require('crypto');
            const content = fs.readFileSync(filePath);
            return crypto.createHash('md5').update(content).digest('hex');
        }
        catch {
            return '';
        }
    }
}
//# sourceMappingURL=file-watcher.js.map