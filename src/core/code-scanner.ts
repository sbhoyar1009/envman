import * as fs from 'fs'
import * as path from 'path'
import { logger } from '../utils/logger.js'

/**
 * Result of scanning codebase for environment variable usage
 */
export interface ScanResult {
  definedVars: string[]
  usedVars: Map<string, UsageInfo[]>
  unusedVars: string[]
  missingVars: string[]
  filesScanned: number
  scanDuration: number
}

/**
 * Information about where a variable is used
 */
export interface UsageInfo {
  file: string
  line: number
  context: string
}

/**
 * Options for scanning
 */
export interface ScanOptions {
  directory?: string
  includePatterns?: string[]
  excludePatterns?: string[]
  maxFiles?: number
}

/**
 * Code scanner for finding environment variable usage
 */
export class CodeScanner {
  private readonly defaultIncludePatterns = [
    '**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx',
    '**/*.py', '**/*.rb', '**/*.php', '**/*.go', '**/*.java'
  ]

  private readonly defaultExcludePatterns = [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/*.min.js',
    '**/vendor/**',
    '**/__pycache__/**'
  ]

  /**
   * Scan directory for environment variable usage
   */
  async scanDirectory(directory: string, options: ScanOptions = {}): Promise<ScanResult> {
    const startTime = Date.now()
    const {
      includePatterns = this.defaultIncludePatterns,
      excludePatterns = this.defaultExcludePatterns,
      maxFiles = 1000
    } = options

    const files = this.findFiles(directory, includePatterns, excludePatterns, maxFiles)
    const usedVars = new Map<string, UsageInfo[]>()

    logger.debug(`Found ${files.length} files to scan`)

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8')
        const language = this.detectLanguage(file)
        const varsInFile = this.findEnvUsage(content, language)

        for (const { variable, line, context } of varsInFile) {
          if (!usedVars.has(variable)) {
            usedVars.set(variable, [])
          }
          usedVars.get(variable)!.push({
            file: path.relative(directory, file),
            line,
            context: context.trim()
          })
        }
      } catch (error) {
        logger.debug(`Failed to scan ${file}: ${error}`)
      }
    }

    // Get defined variables from .env file
    const definedVars = this.getDefinedVars(directory)

    // Calculate unused and missing variables
    const unusedVars = definedVars.filter(key => !usedVars.has(key))
    const missingVars = Array.from(usedVars.keys()).filter(key => !definedVars.includes(key))

    const scanDuration = Date.now() - startTime

    return {
      definedVars,
      usedVars,
      unusedVars,
      missingVars,
      filesScanned: files.length,
      scanDuration
    }
  }

  /**
   * Find files matching patterns
   */
  private findFiles(directory: string, includePatterns: string[], excludePatterns: string[], maxFiles: number): string[] {
    const files: string[] = []

    const walk = (dir: string) => {
      if (files.length >= maxFiles) return

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)

          if (this.shouldIgnorePath(fullPath, excludePatterns)) {
            continue
          }

          if (entry.isDirectory()) {
            walk(fullPath)
          } else if (entry.isFile() && this.matchesPatterns(fullPath, includePatterns)) {
            files.push(fullPath)
          }

          if (files.length >= maxFiles) break
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    walk(directory)
    return files
  }

  /**
   * Check if path should be ignored
   */
  private shouldIgnorePath(filePath: string, excludePatterns: string[]): boolean {
    return excludePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'))
      return regex.test(filePath)
    })
  }

  /**
   * Check if path matches include patterns
   */
  private matchesPatterns(filePath: string, includePatterns: string[]): boolean {
    return includePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'))
      return regex.test(filePath)
    })
  }

  /**
   * Detect programming language from file extension
   */
  detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()

    switch (ext) {
      case '.js':
      case '.jsx':
      case '.ts':
      case '.tsx':
        return 'javascript'
      case '.py':
        return 'python'
      case '.rb':
        return 'ruby'
      case '.php':
        return 'php'
      case '.go':
        return 'go'
      case '.java':
        return 'java'
      default:
        return 'unknown'
    }
  }

  /**
   * Find environment variable usage in file content
   */
  findEnvUsage(content: string, language: string): Array<{ variable: string, line: number, context: string }> {
    const usages: Array<{ variable: string, line: number, context: string }> = []
    const lines = content.split('\n')

    const patterns = this.getPatternsForLanguage(language)

    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        const matches = line.match(pattern.regex)
        if (matches) {
          for (const match of matches) {
            const variable = match.replace(pattern.prefix, '').replace(pattern.suffix, '')
            if (variable && this.isValidEnvVarName(variable)) {
              usages.push({
                variable,
                line: index + 1,
                context: line.trim()
              })
            }
          }
        }
      }
    })

    return usages
  }

  /**
   * Get regex patterns for different languages
   */
  private getPatternsForLanguage(language: string): Array<{ regex: RegExp, prefix: string, suffix: string }> {
    switch (language) {
      case 'javascript':
        return [
          { regex: /process\.env\.([A-Z_][A-Z0-9_]*)/g, prefix: 'process.env.', suffix: '' },
          { regex: /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g, prefix: 'import.meta.env.', suffix: '' }
        ]
      case 'python':
        return [
          { regex: /os\.getenv\(['"]([A-Z_][A-Z0-9_]*)['"]\)/g, prefix: "os.getenv('", suffix: "')" },
          { regex: /os\.getenv\(["']([A-Z_][A-Z0-9_]*)["']\)/g, prefix: 'os.getenv("', suffix: '")' },
          { regex: /os\.environ\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g, prefix: "os.environ['", suffix: "']" },
          { regex: /os\.environ\[["']([A-Z_][A-Z0-9_]*)["']\]/g, prefix: 'os.environ["', suffix: '"]' }
        ]
      case 'ruby':
        return [
          { regex: /ENV\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g, prefix: "ENV['", suffix: "']" },
          { regex: /ENV\[["']([A-Z_][A-Z0-9_]*)["']\]/g, prefix: 'ENV["', suffix: '"]' }
        ]
      case 'php':
        return [
          { regex: /\$_ENV\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g, prefix: "$_ENV['", suffix: "']" },
          { regex: /\$_ENV\[["']([A-Z_][A-Z0-9_]*)["']\]/g, prefix: '$_ENV["', suffix: '"]' },
          { regex: /getenv\(['"]([A-Z_][A-Z0-9_]*)['"]\)/g, prefix: "getenv('", suffix: "')" },
          { regex: /getenv\(["']([A-Z_][A-Z0-9_]*)["']\)/g, prefix: 'getenv("', suffix: '")' }
        ]
      case 'go':
        return [
          { regex: /os\.Getenv\(["']([A-Z_][A-Z0-9_]*)["']\)/g, prefix: 'os.Getenv("', suffix: '")' }
        ]
      case 'java':
        return [
          { regex: /System\.getenv\(["']([A-Z_][A-Z0-9_]*)["']\)/g, prefix: 'System.getenv("', suffix: '")' }
        ]
      default:
        return []
    }
  }

  /**
   * Check if string is a valid environment variable name
   */
  private isValidEnvVarName(name: string): boolean {
    return /^[A-Z_][A-Z0-9_]*$/.test(name)
  }

  /**
   * Get defined variables from .env file
   */
  private getDefinedVars(directory: string): string[] {
    const envPath = path.join(directory, '.env')
    try {
      const content = fs.readFileSync(envPath, 'utf-8')
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('=')[0])
        .filter(key => key && this.isValidEnvVarName(key))
    } catch {
      return []
    }
  }

  /**
   * Generate human-readable report
   */
  generateReport(result: ScanResult): void {
    logger.header('🔍 Environment Variable Usage Analysis')

    logger.info(`Scanned ${result.filesScanned} files in ${(result.scanDuration / 1000).toFixed(1)}s`)

    // Variables in .env
    logger.blank()
    logger.highlight(`📊 Variables in .env (${result.definedVars.length}):`)
    if (result.definedVars.length > 0) {
      const used = result.definedVars.filter(key => !result.unusedVars.includes(key))
      const unused = result.unusedVars.length
      logger.success(`  ✓ Used in code (${used.length})`)
      if (unused > 0) {
        logger.warn(`  ⚠️  Unused (${unused})`)
      }
    }

    // Variables used in code but missing from .env
    if (result.missingVars.length > 0) {
      logger.blank()
      logger.error(`❌ Variables used in code but missing from .env (${result.missingVars.length}):`)
      result.missingVars.forEach(key => {
        const usages = result.usedVars.get(key) || []
        logger.info(`  ${key}`)
        usages.slice(0, 2).forEach(usage => {
          logger.dim(`     Found in: ${usage.file}:${usage.line}`)
        })
        if (usages.length > 2) {
          logger.dim(`     ... and ${usages.length - 2} more`)
        }
      })
    }

    // Unused variables
    if (result.unusedVars.length > 0) {
      logger.blank()
      logger.warn(`⚠️  Unused variables in .env (${result.unusedVars.length}):`)
      result.unusedVars.forEach(key => {
        logger.dim(`  ${key} (not referenced anywhere)`)
      })
    }

    // Most frequently used variables
    if (result.usedVars.size > 0) {
      logger.blank()
      logger.highlight('🔥 Most frequently used variables:')
      const sorted = Array.from(result.usedVars.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 5)

      sorted.forEach(([key, usages], index) => {
        logger.info(`  ${index + 1}. ${key} (referenced ${usages.length} times in ${new Set(usages.map(u => u.file)).size} files)`)
      })
    }

    // Suggestions
    logger.blank()
    logger.highlight('💡 Suggestions:')
    if (result.missingVars.length > 0) {
      logger.info('  • Add missing variables to .env')
    }
    if (result.unusedVars.length > 0) {
      logger.info('  • Consider removing unused variables')
    }
    if (result.missingVars.length > 0) {
      logger.info('  • Document missing variables in .env.template')
    }
  }
}