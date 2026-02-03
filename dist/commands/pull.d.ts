import { Command } from 'commander';
interface PullOptions {
    env?: string;
    force?: boolean;
}
/**
 * Pull and decrypt environment variables from cloud
 */
export declare function pullCommand(options: PullOptions): Promise<void>;
/**
 * Register pull command with Commander
 */
export declare function registerPullCommand(program: Command): void;
export {};
//# sourceMappingURL=pull.d.ts.map