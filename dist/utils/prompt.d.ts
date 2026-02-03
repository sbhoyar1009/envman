/**
 * Prompt for user email
 */
export declare function promptEmail(): Promise<string>;
/**
 * Prompt for password
 */
export declare function promptPassword(): Promise<string>;
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
//# sourceMappingURL=prompt.d.ts.map