import { Command } from 'commander';
interface RotateOptions {
    allSecrets?: boolean;
    environments?: string[];
    length?: number;
    type?: 'uuid' | 'hex' | 'base64' | 'alphanumeric' | 'jwt';
    force?: boolean;
}
/**
 * Rotate secrets with new generated values
 */
export declare function rotateCommand(keyOrOptions: string | undefined, options: RotateOptions): Promise<void>;
/**
 * Register rotate command with Commander
 */
export declare function registerRotateCommand(program: Command): void;
export {};
//# sourceMappingURL=rotate.d.ts.map