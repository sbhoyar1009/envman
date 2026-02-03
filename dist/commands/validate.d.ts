import { Command } from 'commander';
interface ValidateOptions {
    env?: string;
    strict?: boolean;
    template?: string;
    fix?: boolean;
}
/**
 * Validate environment variables
 */
export declare function validateCommand(options: ValidateOptions): Promise<void>;
/**
 * Register validate command with Commander
 */
export declare function registerValidateCommand(program: Command): void;
export {};
//# sourceMappingURL=validate.d.ts.map