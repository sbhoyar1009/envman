import { Command } from 'commander'
import * as fs from 'fs'
import ora from 'ora'
import { configManager } from '../core/config-manager.js'
import { logger } from '../utils/logger.js'
import { parseEnvFile } from '../utils/env-parser.js'
import { SecretGenerator } from '../utils/secret-generator.js'

interface ValidateOptions {
  env?: string
  strict?: boolean
  template?: string
  fix?: boolean
}

/**
 * Validation result
 */
interface ValidationResult {
  isValid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  info: ValidationIssue[]
  score: number
}

/**
 * Validation issue
 */
interface ValidationIssue {
  severity: 'error' | 'warning' | 'info'
  key?: string
  message: string
  suggestion?: string
}

/**
 * Validate environment variables
 */
export async function validateCommand(options: ValidateOptions): Promise<void> {
  try {
    // Check project initialization
    const projectConfig = configManager.loadProject()
    if (!projectConfig) {
      logger.error('Project not initialized. Please run: envman init')
      process.exit(1)
    }

    logger.header('🔍 Environment Validation')

    const envFile = '.env'
    if (!fs.existsSync(envFile)) {
      logger.error(`Local .env file not found: ${envFile}`)
      process.exit(1)
    }

    // Determine what to validate against
    let variables: Record<string, string>
    let source: string

    if (options.env) {
      // Validate remote environment (not implemented yet - mock)
      logger.warn('Remote environment validation not yet implemented')
      variables = parseEnvFile(envFile) // Fallback to local
      source = `local .env (remote validation mocked)`
    } else {
      // Validate local .env
      variables = parseEnvFile(envFile)
      source = 'local .env'
    }

    logger.info(`Validating: ${source}`)
    logger.blank()

    const spinner = ora('Analyzing environment variables...').start()

    // Perform validation
    const result = await validateVariables(variables, options)

    spinner.succeed('Validation complete!')

    // Display results
    displayResults(result, options.strict || false)

    // Auto-fix if requested
    if (options.fix && (result.errors.length > 0 || result.warnings.length > 0)) {
      await applyFixes(variables, result, envFile)
    }

  } catch (error) {
    logger.error(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

/**
 * Validate variables against various rules
 */
async function validateVariables(variables: Record<string, string>, options: ValidateOptions): Promise<ValidationResult> {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const info: ValidationIssue[] = []

  const secretGenerator = new SecretGenerator()

  // Check for required variables (if template exists)
  if (options.template || fs.existsSync('.env.template')) {
    const templateFile = options.template || '.env.template'
    try {
      const templateContent = fs.readFileSync(templateFile, 'utf-8')
      const templateVars = parseTemplate(templateContent)

      for (const key of templateVars) {
        if (!(key in variables)) {
          errors.push({
            severity: 'error',
            key,
            message: `Missing required variable`,
            suggestion: `Add ${key} to .env file`
          })
        }
      }
    } catch (error) {
      warnings.push({
        severity: 'warning',
        message: `Could not read template file: ${templateFile}`
      })
    }
  }

  // Validate each variable
  for (const [key, value] of Object.entries(variables)) {
    // Check naming convention
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      warnings.push({
        severity: 'warning',
        key,
        message: `Variable name should use SCREAMING_SNAKE_CASE`,
        suggestion: `Rename to ${key.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`
      })
    }

    // Check for empty values
    if (!value.trim()) {
      errors.push({
        severity: 'error',
        key,
        message: `Variable has empty value`,
        suggestion: `Provide a value for ${key}`
      })
    }

    // Check for default/example values
    if (isDefaultValue(value)) {
      errors.push({
        severity: 'error',
        key,
        message: `Value appears to be default/example`,
        suggestion: `Replace with actual value`
      })
    }

    // Type-specific validation
    const typeValidation = validateType(key, value)
    if (typeValidation) {
      if (typeValidation.severity === 'error') {
        errors.push(typeValidation)
      } else {
        warnings.push(typeValidation)
      }
    }

    // Security checks
    if (secretGenerator.isLikelySecret(key)) {
      if (value.length < 16) {
        warnings.push({
          severity: 'warning',
          key,
          message: `Secret appears too short (${value.length} chars)`,
          suggestion: `Use at least 16 characters for secrets`
        })
      }

      if (value.includes(' ') || value.includes('\t')) {
        warnings.push({
          severity: 'warning',
          key,
          message: `Secret contains whitespace`,
          suggestion: `Remove spaces/tabs from secret value`
        })
      }
    }

    // Check for hardcoded sensitive data
    if (containsHardcodedSecrets(value)) {
      warnings.push({
        severity: 'warning',
        key,
        message: `Value may contain hardcoded sensitive data`,
        suggestion: `Review and replace with proper secret`
      })
    }
  }

  // Calculate score (0-100)
  const totalIssues = errors.length + warnings.length
  const score = Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5))

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    info,
    score
  }
}

/**
 * Parse .env.template file for required variables
 */
function parseTemplate(content: string): string[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('=')[0])
    .filter(key => key)
}

/**
 * Check if value looks like a default/example
 */
function isDefaultValue(value: string): boolean {
  const defaults = [
    'your-secret-here',
    'your-key-here',
    'your-token-here',
    'your-password-here',
    'example',
    'sample',
    'placeholder',
    'change-me',
    'replace-me',
    'xxx',
    '123456',
    'abcdef'
  ]

  const lowerValue = value.toLowerCase()
  return defaults.some(defaultVal => lowerValue.includes(defaultVal))
}

/**
 * Validate variable type based on name
 */
function validateType(key: string, value: string): ValidationIssue | null {
  const lowerKey = key.toLowerCase()

  // URL validation
  if (lowerKey.includes('url') || lowerKey.includes('endpoint') || lowerKey.includes('host')) {
    if (value && !value.match(/^https?:\/\//) && !value.match(/^redis:\/\//) && !value.match(/^postgres:\/\//)) {
      return {
        severity: 'warning',
        key,
        message: `Invalid URL format`,
        suggestion: `Should start with http://, https://, redis://, or postgres://`
      }
    }
  }

  // Email validation
  if (lowerKey.includes('email')) {
    if (value && !value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return {
        severity: 'warning',
        key,
        message: `Invalid email format`,
        suggestion: `Should be a valid email address`
      }
    }
  }

  // Port validation
  if (lowerKey.includes('port')) {
    const port = parseInt(value)
    if (isNaN(port) || port < 1 || port > 65535) {
      return {
        severity: 'warning',
        key,
        message: `Invalid port number`,
        suggestion: `Should be a number between 1-65535`
      }
    }
  }

  // Boolean validation
  if (lowerKey.includes('enable') || lowerKey.includes('disable') || lowerKey.includes('debug') || lowerKey.includes('ssl')) {
    if (value && !['true', 'false', '1', '0', 'yes', 'no'].includes(value.toLowerCase())) {
      return {
        severity: 'info',
        key,
        message: `Expected boolean value`,
        suggestion: `Use true/false, 1/0, or yes/no`
      }
    }
  }

  return null
}

/**
 * Check for hardcoded secrets
 */
function containsHardcodedSecrets(value: string): boolean {
  // Check for IP addresses (potential hardcoded)
  if (value.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/)) {
    return true
  }

  // Check for long alphanumeric strings that might be keys
  if (value.match(/[a-zA-Z0-9]{32,}/)) {
    return true
  }

  return false
}

/**
 * Display validation results
 */
function displayResults(result: ValidationResult, strict: boolean): void {
  if (result.errors.length > 0) {
    logger.error(`❌ ERRORS (${result.errors.length}):`)
    result.errors.forEach(issue => {
      const key = issue.key ? `${issue.key}: ` : ''
      logger.info(`  ${key}${issue.message}`)
      if (issue.suggestion) {
        logger.dim(`    💡 ${issue.suggestion}`)
      }
    })
    logger.blank()
  }

  if (result.warnings.length > 0) {
    logger.warn(`⚠️  WARNINGS (${result.warnings.length}):`)
    result.warnings.forEach(issue => {
      const key = issue.key ? `${issue.key}: ` : ''
      logger.info(`  ${key}${issue.message}`)
      if (issue.suggestion) {
        logger.dim(`    💡 ${issue.suggestion}`)
      }
    })
    logger.blank()
  }

  if (result.info.length > 0) {
    logger.info(`ℹ️  INFO (${result.info.length}):`)
    result.info.forEach(issue => {
      const key = issue.key ? `${issue.key}: ` : ''
      logger.info(`  ${key}${issue.message}`)
      if (issue.suggestion) {
        logger.dim(`    💡 ${issue.suggestion}`)
      }
    })
    logger.blank()
  }

  // Overall score
  const scoreColor = result.score >= 80 ? 'success' : result.score >= 60 ? 'warn' : 'error'
  logger[scoreColor](`Security Score: ${result.score}/100`)

  if (result.errors.length > 0 && !strict) {
    logger.blank()
    logger.info('💡 Run with --fix to auto-correct formatting issues')
  }
}

/**
 * Apply automatic fixes
 */
async function applyFixes(variables: Record<string, string>, result: ValidationResult, envFile: string): Promise<void> {
  logger.info('🔧 Applying automatic fixes...')

  let fixed = false

  // Fix naming convention issues
  for (const issue of result.warnings) {
    if (issue.key && issue.message.includes('SCREAMING_SNAKE_CASE') && issue.suggestion) {
      const newKey = issue.suggestion.replace('Rename to ', '')
      if (newKey !== issue.key) {
        variables[newKey] = variables[issue.key]
        delete variables[issue.key]
        logger.success(`✓ Renamed ${issue.key} → ${newKey}`)
        fixed = true
      }
    }
  }

  if (fixed) {
    // Write back to file
    const content = Object.entries(variables)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n'

    fs.writeFileSync(envFile, content)
    logger.success('✓ Applied fixes to .env file')
  } else {
    logger.info('ℹ️  No automatic fixes available')
  }
}

/**
 * Register validate command with Commander
 */
export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate environment variables for issues')
    .option('-e, --env <environment>', 'Validate remote environment (not implemented)')
    .option('--strict', 'Fail on warnings')
    .option('-t, --template <file>', 'Validate against template file')
    .option('--fix', 'Auto-fix formatting issues')
    .action(validateCommand)
}