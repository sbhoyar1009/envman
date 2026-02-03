import { Command } from 'commander';
interface PushOptions {
    env?: string;
    force?: boolean;
}
/**
 * Push environment variables to cloud
 */
export declare function pushCommand(options: PushOptions): Promise<void>;
/**
 * Register push command with Commander
 */
export declare function registerPushCommand(program: Command): void;
export {};
//# sourceMappingURL=push.d.ts.map