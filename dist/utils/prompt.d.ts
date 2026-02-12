/**
 * Prompt for email
 */
export declare function promptEmail(): Promise<string>;
/**
 * Prompt for password
 */
export declare function promptPassword(message?: string): Promise<string>;
/**
 * Prompt for confirmation
 */
export declare function promptConfirm(message: string): Promise<boolean>;
/**
 * Prompt for project name
 */
export declare function promptProjectName(defaultName: string): Promise<string>;
/**
 * Prompt for environment selection
 */
export declare function promptEnvironment(defaultEnv: string, choices?: string[]): Promise<string>;
/**
 * Prompt for multiple choice
 */
export declare function promptChoice(message: string, choices: string[], defaultChoice?: string): Promise<string>;
/**
 * Prompt for multiple selections
 */
export declare function promptCheckbox(message: string, choices: string[]): Promise<string[]>;
/**
 * Prompt for project hash input
 */
export declare function promptProjectHash(): Promise<string>;
/**
 * Prompt to select from pending invites
 */
export declare function promptPendingInvite(invites: Array<{
    project: string;
    role: string;
    invitedBy: string;
    invitedAt: string;
}>): Promise<string | null>;
//# sourceMappingURL=prompt.d.ts.map