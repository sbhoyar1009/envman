import chalk from 'chalk';
/**
 * Logger utility for consistent CLI output
 */
class Logger {
    /**
     * Log info message (blue)
     */
    info(message) {
        console.log(chalk.blue('ℹ️  ' + message));
    }
    /**
     * Log success message (green)
     */
    success(message) {
        console.log(chalk.green('✓ ' + message));
    }
    /**
     * Log warning message (yellow)
     */
    warn(message) {
        console.log(chalk.yellow('⚠️  ' + message));
    }
    /**
     * Log error message (red)
     */
    error(message) {
        console.log(chalk.red('❌ ' + message));
    }
    /**
     * Log debug message (dim)
     */
    debug(message) {
        if (process.env.DEBUG) {
            console.log(chalk.dim('🐛 ' + message));
        }
    }
    /**
     * Log dimmed message (gray)
     */
    dim(message) {
        console.log(chalk.gray(message));
    }
    /**
     * Log highlighted value (cyan)
     */
    highlight(message) {
        console.log(chalk.cyan(message));
    }
    /**
     * Log header (bold blue)
     */
    header(message) {
        console.log(chalk.bold.blue('\n' + message + '\n'));
    }
    /**
     * Log empty line
     */
    blank() {
        console.log('');
    }
}
export const logger = new Logger();
//# sourceMappingURL=logger.js.map