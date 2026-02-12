import { Command } from 'commander';
/**
 * Login to envman account
 */
export declare function loginCommand(): Promise<void>;
export declare function signupCommand(): Promise<void>;
/**
 * Logout from envman
 */
export declare function logoutCommand(): Promise<void>;
/**
 * Register login/logout commands with Commander
 */
export declare function registerAuthCommands(program: Command): void;
//# sourceMappingURL=auth.d.ts.map