/**
 * Parse .env file into key-value pairs
 */
export declare function parseEnvFile(filePath: string): Record<string, string>;
/**
 * Write variables to .env file
 */
export declare function writeEnvFile(filePath: string, vars: Record<string, string>): void;
/**
 * Create .env.template file with keys only
 */
export declare function createTemplate(sourceFile: string, templateFile: string): void;
/**
 * Check if env file exists
 */
export declare function envFileExists(filePath: string): boolean;
/**
 * Update .gitignore to include .env and .envman files
 */
export declare function updateGitignore(gitignorePath: string, entries: string[]): void;
/**
 * Get directory name from path
 */
export declare function getDirectoryName(): string;
//# sourceMappingURL=env-parser.d.ts.map