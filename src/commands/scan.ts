import { Command } from 'commander'
import * as path from 'path'
import ora from 'ora'
import { configManager } from '../core/config-manager.js'
import { logger } from '../utils/logger.js'
import { CodeScanner, ScanResult, ScanOptions } from '../core/code-scanner.js'

interface ScanCommandOptions {
  directory?: string
  unused?: boolean
  missing?: boolean
  output?: string
}

/**
 * Scan codebase for environment variable usage
 */
export async function scanCommand(options: ScanCommandOptions): Promise<void> {
  try {
    // Check project initialization
    const projectConfig = configManager.loadProject()
    if (!projectConfig) {
      logger.warn('Project not initialized. Scanning current directory anyway...')
    }

    logger.header('🔍 Scanning Codebase for Environment Variables')

    // Determine scan directory
    const scanDir = options.directory
      ? path.resolve(options.directory)
      : process.cwd()

    logger.info(`Scanning directory: ${scanDir}`)

    // Initialize scanner
    const scanner = new CodeScanner()
    const scanOptions: ScanOptions = {
      directory: scanDir
    }

    // Show progress
    const spinner = ora('Scanning codebase...').start()

    try {
      // Perform scan
      const result = await scanner.scanDirectory(scanDir, scanOptions)

      spinner.succeed(`Scan complete! Found ${result.usedVars.size} unique variables in ${result.filesScanned} files`)

      // Filter results based on options
      if (options.unused) {
        displayUnusedOnly(result)
      } else if (options.missing) {
        displayMissingOnly(result)
      } else {
        // Full report
        scanner.generateReport(result)
      }

      // Export to file if requested
      if (options.output) {
        await exportResults(result, options.output)
      }

    } catch (error) {
      spinner.fail('Scan failed')
      throw error
    }

  } catch (error) {
    logger.error(`Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

/**
 * Display only unused variables
 */
function displayUnusedOnly(result: ScanResult): void {
  logger.blank()
  logger.highlight(`⚠️  Unused variables in .env (${result.unusedVars.length}):`)

  if (result.unusedVars.length === 0) {
    logger.success('  ✓ All variables in .env are used!')
    return
  }

  result.unusedVars.forEach((key: string) => {
    logger.dim(`  ${key} (not referenced anywhere)`)
  })

  logger.blank()
  logger.info('💡 Consider removing these unused variables from your .env file')
}

/**
 * Display only missing variables
 */
function displayMissingOnly(result: ScanResult): void {
  logger.blank()
  logger.highlight(`❌ Variables used in code but missing from .env (${result.missingVars.length}):`)

  if (result.missingVars.length === 0) {
    logger.success('  ✓ All variables used in code are defined in .env!')
    return
  }

  result.missingVars.forEach((key: string) => {
    const usages = result.usedVars.get(key) || []
    logger.info(`  ${key}`)
    usages.slice(0, 3).forEach((usage) => {
      logger.dim(`     Found in: ${usage.file}:${usage.line}`)
    })
    if (usages.length > 3) {
      logger.dim(`     ... and ${usages.length - 3} more locations`)
    }
  })

  logger.blank()
  logger.info('💡 Add these variables to your .env file')
}

/**
 * Export results to file
 */
async function exportResults(result: ScanResult, outputPath: string): Promise<void> {
  const fs = await import('fs')
  const exportData = {
    scan_timestamp: new Date().toISOString(),
    scan_directory: process.cwd(),
    files_scanned: result.filesScanned,
    scan_duration_ms: result.scanDuration,
    variables: {
      defined_in_env: result.definedVars,
      used_in_code: Array.from(result.usedVars.keys()),
      unused_in_env: result.unusedVars,
      missing_from_env: result.missingVars
    },
    detailed_usage: Object.fromEntries(
      Array.from(result.usedVars.entries()).map(([key, usages]) => [
        key,
        usages.map((u) => ({
          file: u.file,
          line: u.line,
          context: u.context
        }))
      ])
    )
  }

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2))
  logger.success(`Results exported to: ${outputPath}`)
}

/**
 * Register scan command with Commander
 */
export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Scan codebase for environment variable usage')
    .option('-d, --directory <dir>', 'Directory to scan (default: current directory)')
    .option('--unused', 'Show only unused variables in .env')
    .option('--missing', 'Show only variables used in code but missing from .env')
    .option('-o, --output <file>', 'Export results to JSON file')
    .action(scanCommand)
}