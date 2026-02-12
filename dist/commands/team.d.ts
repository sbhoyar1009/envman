import { Command } from 'commander';
interface TeamOptions {
    action?: 'list' | 'invite' | 'remove' | 'sync' | 'join';
    email?: string;
    role?: string;
    hash?: string;
}
/**
 * Team management commands
 */
export declare function teamCommand(options: TeamOptions): Promise<void>;
/**
 * Register team command with Commander
 */
export declare function registerTeamCommand(program: Command): void;
export {};
//# sourceMappingURL=team.d.ts.map