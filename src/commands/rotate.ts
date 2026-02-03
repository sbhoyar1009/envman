import { Command } from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import ora from 'ora'
import { configManager } from '../core/config-manager.js'
import { apiClient } from '../core/api-client.js'
import { EncryptionManager } from '../core/encryption.js'
import { logger } from '../utils/logger.js'
import { parseEnvFile, writeEnvFile } from '../utils/env-parser.js'
import { promptChoice, promptConfirm } from '../utils/prompt.js'
import { SecretGenerator } from '../utils/secret-generator.js'

interface RotateOptions {
  allSecrets?: boolean
  environments?: string[]
  length?: number
  type?: 'uuid' | 'hex' | 'base64' | 'alphanumeric' | 'jwt'
  force?: boolean
}

/**
 * Rotate secrets with new generated values
 */
export async function rotateCommand(keyOrOptions: string | undefined, options: RotateOptions): Promise<void> {
  try {
    // Check authentication
    if (!configManager.isAuthenticated()) {
      logger.error('Not authenticated. Please run: envman login')
      process.exit(1)
    }

    // Check project initialization
    const projectConfig = configManager.loadProject()
    if (!projectConfig) {
      logger.error('Project not initialized. Please run: envman init')
      process.exit(1)
    }

    // Check permissions
    await configManager.requirePermission('write', 'rotate secrets')

    logger.header('🔄 Secret Rotation')

    const envFile = '.env'
    if (!fs.existsSync(envFile)) {
      logger.error(`Local .env file not found: ${envFile}`)
      process.exit(1)
    }

    // Determine what to rotate
    let keysToRotate: string[]

    if (options.allSecrets) {
      // Rotate all detected secrets
      keysToRotate = await getAllSecrets(envFile)
      if (keysToRotate.length === 0) {
        logger.warn('No secrets detected in .env file')
        return
      }
    } else if (keyOrOptions) {
      // Rotate specific key
      keysToRotate = [keyOrOptions]
    } else {
      logger.error('Specify a key to rotate or use --all-secrets')
      process.exit(1)
    }

    // Get target environments
    const environments = options.environments || ['development']
    const validEnvs = environments.filter(env => projectConfig.environments.includes(env))

    if (validEnvs.length === 0) {
      logger.error('No valid environments specified')
      process.exit(1)
    }

    // Confirm operation
    if (!options.force) {
      const keyList = keysToRotate.join(', ')
      const envList = validEnvs.join(', ')

      logger.info(`Rotating: ${keyList}`)
      logger.info(`This will update:`)
      logger.info(`  ✓ Local .env`)
      validEnvs.forEach(env => logger.info(`  ✓ ${env} environment`))

      const secretGenerator = new SecretGenerator()
      const sampleKey = keysToRotate[0]
      const newValue = secretGenerator.generate(options.type || 'hex', options.length)
      logger.info(`New value will be generated as: ${options.type || 'hex'} (${newValue.length} chars)`)

      logger.blank()
      logger.warn('⚠️  Warning: This may break running applications until redeployed')

      const confirmed = await promptConfirm('Proceed? (y/N)')
      if (!confirmed) {
        logger.info('Rotation cancelled')
        return
      }
    }

    // Perform rotation
    await performRotation(keysToRotate, validEnvs, envFile, options)

  } catch (error) {
    logger.error(`Rotation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

/**
 * Get all secrets from .env file
 */
async function getAllSecrets(envFile: string): Promise<string[]> {
  const variables = parseEnvFile(envFile)
  const secretGenerator = new SecretGenerator()

  return Object.keys(variables).filter(key => secretGenerator.isLikelySecret(key))
}

/**
 * Perform the actual rotation
 */
async function performRotation(
  keys: string[],
  environments: string[],
  envFile: string,
  options: RotateOptions
): Promise<void> {
  const secretGenerator = new SecretGenerator()
  const projectConfig = configManager.loadProject()!
  const encryption = new EncryptionManager(projectConfig.projectName)

  // Create backup directory if it doesn't exist
  const backupDir = path.join('.envman', 'rotations')
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  // Process each key
  for (const key of keys) {
    logger.info(`Rotating: ${key}`)

    // Generate new secret
    const newValue = secretGenerator.generate(options.type || 'hex', options.length)
    logger.success(`✓ Generated: ${newValue.slice(0, 20)}... (${newValue.length} chars)`)

    // Backup old value
    const variables = parseEnvFile(envFile)
    const oldValue = variables[key]

    if (oldValue) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFile = path.join(backupDir, `${key}_${timestamp}.backup`)
      fs.writeFileSync(backupFile, `${key}=${oldValue}`)
      logger.info(`Old value saved to: ${backupFile}`)
    }

    // Update local .env
    variables[key] = newValue
    writeEnvFile(envFile, variables)
    logger.success('✓ Local .env updated')

    // Update each environment
    for (const env of environments) {
      const spinner = ora(`Updating ${env}...`).start()

      try {
        // Encrypt and push
        const encryptedVars = encryption.encryptVariables({ [key]: newValue })
        const response = await apiClient.pushVariables(projectConfig.projectName, env, encryptedVars)

        if (!response.success) {
          throw new Error(response.message)
        }

        spinner.succeed(`✓ ${env} updated`)
      } catch (error) {
        spinner.fail(`✗ ${env} failed: ${error}`)
      }
    }

    logger.blank()
  }

  logger.success('Rotation complete!')
  logger.blank()
  logger.info('Next steps:')
  logger.info('  • Redeploy applications to use new secrets')
  logger.info('  • Update any external services using these keys')
  logger.info('  • Verify everything works, then delete backup files')
}

/**
 * Register rotate command with Commander
 */
export function registerRotateCommand(program: Command): void {
  program
    .command('rotate [key]')
    .description('Rotate secrets with new generated values')
    .option('--all-secrets', 'Rotate all detected secrets')
    .option('-e, --environments <envs>', 'Target environments (comma-separated)', (value) => value.split(','))
    .option('-l, --length <number>', 'Secret length', parseInt)
    .option('-t, --type <type>', 'Secret type: uuid, hex, base64, alphanumeric, jwt')
    .option('-f, --force', 'Skip confirmation prompts')
    .action(rotateCommand)
}