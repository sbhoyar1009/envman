import chalk from 'chalk'

/**
 * Logger utility for consistent CLI output
 */
class Logger {
  /**
   * Log info message (blue)
   */
  info(message: string): void {
    console.log(chalk.blue('ℹ️  ' + message))
  }

  /**
   * Log success message (green)
   */
  success(message: string): void {
    console.log(chalk.green('✓ ' + message))
  }

  /**
   * Log warning message (yellow)
   */
  warn(message: string): void {
    console.log(chalk.yellow('⚠️  ' + message))
  }

  /**
   * Log error message (red)
   */
  error(message: string): void {
    console.log(chalk.red('❌ ' + message))
  }

  /**
   * Log debug message (dim)
   */
  debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(chalk.dim('🐛 ' + message))
    }
  }

  /**
   * Log dimmed message (gray)
   */
  dim(message: string): void {
    console.log(chalk.gray(message))
  }

  /**
   * Log highlighted value (cyan)
   */
  highlight(message: string): void {
    console.log(chalk.cyan(message))
  }

  /**
   * Log header (bold blue)
   */
  header(message: string): void {
    console.log(chalk.bold.blue('\n' + message + '\n'))
  }

  /**
   * Log empty line
   */
  blank(): void {
    console.log('')
  }
}

export const logger = new Logger()
