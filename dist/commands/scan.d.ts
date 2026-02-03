import { Command } from 'commander';
interface ScanCommandOptions {
    directory?: string;
    unused?: boolean;
    missing?: boolean;
    output?: string;
}
/**
 * Scan codebase for environment variable usage
 */
export declare function scanCommand(options: ScanCommandOptions): Promise<void>;
/**
 * Register scan command with Commander
 */
export declare function registerScanCommand(program: Command): void;
export {};
//# sourceMappingURL=scan.d.ts.map