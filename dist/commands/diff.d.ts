import { Command } from 'commander';
interface DiffOptions {
    env?: string;
    file?: string;
}
/**
 * Compare local environment variables with remote
 */
export declare function diffCommand(options: DiffOptions): Promise<void>;
/**
 * Register diff command with Commander
 */
export declare function registerDiffCommand(program: Command): void;
export {};
//# sourceMappingURL=diff.d.ts.map