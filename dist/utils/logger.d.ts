/**
 * Logger utility for consistent CLI output
 */
declare class Logger {
    /**
     * Log info message (blue)
     */
    info(message: string): void;
    /**
     * Log success message (green)
     */
    success(message: string): void;
    /**
     * Log warning message (yellow)
     */
    warn(message: string): void;
    /**
     * Log error message (red)
     */
    error(message: string): void;
    /**
     * Log debug message (dim)
     */
    debug(message: string): void;
    /**
     * Log dimmed message (gray)
     */
    dim(message: string): void;
    /**
     * Log highlighted value (cyan)
     */
    highlight(message: string): void;
    /**
     * Log header (bold blue)
     */
    header(message: string): void;
    /**
     * Log empty line
     */
    blank(): void;
}
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map