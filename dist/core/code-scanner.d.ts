/**
 * Result of scanning codebase for environment variable usage
 */
export interface ScanResult {
    definedVars: string[];
    usedVars: Map<string, UsageInfo[]>;
    unusedVars: string[];
    missingVars: string[];
    filesScanned: number;
    scanDuration: number;
}
/**
 * Information about where a variable is used
 */
export interface UsageInfo {
    file: string;
    line: number;
    context: string;
}
/**
 * Options for scanning
 */
export interface ScanOptions {
    directory?: string;
    includePatterns?: string[];
    excludePatterns?: string[];
    maxFiles?: number;
}
/**
 * Code scanner for finding environment variable usage
 */
export declare class CodeScanner {
    private readonly defaultIncludePatterns;
    private readonly defaultExcludePatterns;
    /**
     * Scan directory for environment variable usage
     */
    scanDirectory(directory: string, options?: ScanOptions): Promise<ScanResult>;
    /**
     * Find files matching patterns
     */
    private findFiles;
    /**
     * Check if path should be ignored
     */
    private shouldIgnorePath;
    /**
     * Check if path matches include patterns
     */
    private matchesPatterns;
    /**
     * Detect programming language from file extension
     */
    detectLanguage(filePath: string): string;
    /**
     * Find environment variable usage in file content
     */
    findEnvUsage(content: string, language: string): Array<{
        variable: string;
        line: number;
        context: string;
    }>;
    /**
     * Get regex patterns for different languages
     */
    private getPatternsForLanguage;
    /**
     * Check if string is a valid environment variable name
     */
    private isValidEnvVarName;
    /**
     * Get defined variables from .env file
     */
    private getDefinedVars;
    /**
     * Generate human-readable report
     */
    generateReport(result: ScanResult): void;
}
//# sourceMappingURL=code-scanner.d.ts.map