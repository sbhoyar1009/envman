import { Command } from 'commander';
interface SyncOptions {
    watch?: boolean;
    pushOnly?: boolean;
    pullOnly?: boolean;
    interval?: number;
    env?: string;
}
/**
 * Auto-sync environment variables
 */
export declare function syncCommand(options: SyncOptions): Promise<void>;
/**
 * Register sync command with Commander
 */
export declare function registerSyncCommand(program: Command): void;
export {};
//# sourceMappingURL=sync.d.ts.map