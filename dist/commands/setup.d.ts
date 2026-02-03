import { Command } from 'commander';
interface SetupOptions {
    supabaseUrl?: string;
    supabaseKey?: string;
}
/**
 * Setup cloud sync configuration
 */
export declare function setupCommand(options: SetupOptions): Promise<void>;
/**
 * Register setup command with Commander
 */
export declare function registerSetupCommand(program: Command): void;
export {};
//# sourceMappingURL=setup.d.ts.map