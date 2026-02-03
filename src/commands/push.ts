import { Command } from 'commander'
import ora from 'ora'
import * as fs from 'fs'
import { configManager } from '../core/config-manager.js'
import { apiClient } from '../core/api-client.js'
import { EncryptionManager } from '../core/encryption.js'
import { logger } from '../utils/logger.js'
import { parseEnvFile } from '../utils/env-parser.js'
import { promptConfirm, promptChoice } from '../utils/prompt.js'

interface PushOptions {
  env?: string
  force?: boolean
}

/**
 * Push environment variables to cloud
 */
export async function pushCommand(options: PushOptions): Promise<void> {
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
    await configManager.requirePermission('write', 'push environment variables')

    logger.header('📤 Pushing Environment Variables')

    // Check if .env exists
    if (!fs.existsSync('.env')) {
      logger.error('.env file not found')
      process.exit(1)
    }

    // Get environment
    const environment =
      options.env || (await promptChoice('Select environment:', projectConfig.environments))

    // Check if file exists
    if (!fs.existsSync('.env') && !options.force) {
      const confirm = await promptConfirm('No .env file found. Continue?')
      if (!confirm) {
        logger.info('Push cancelled')
        return
      }
    }

    const spinner = ora('Preparing variables...').start()

    try {
      // Parse .env file
      const variables = parseEnvFile('.env')
      const varCount = Object.keys(variables).length

      spinner.text = `Found ${varCount} variables`

      // Encrypt variables
      const encryption = new EncryptionManager(projectConfig.projectName)
      const encrypted = encryption.encryptVariables(variables)

      spinner.text = `Encrypting ${varCount} variables...`

      // Count secrets
      const secretCount = encrypted.filter(v => v.isSecret).length
      logger.debug(`Detected ${secretCount} as secrets`)

      // Push to server
      spinner.text = 'Uploading to server...'
      const response = await apiClient.pushVariables(
        projectConfig.projectName,
        environment,
        encrypted
      )

      spinner.succeed('Variables pushed successfully!')
      logger.blank()
      logger.highlight(`📊 Summary:`)
      logger.info(`Total variables: ${varCount}`)
      logger.info(`Secrets detected: ${secretCount}`)
      logger.info(`Environment: ${environment}`)
      logger.info(`Status: ${response.success ? '✓ Synced' : '✗ Failed'}`)
    } catch (error) {
      spinner.fail('Failed to push variables')
      throw error
    }
  } catch (error) {
    logger.error(`Push failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

/**
 * Register push command with Commander
 */
export function registerPushCommand(program: Command): void {
  program
    .command('push')
    .option('-e, --env <environment>', 'Environment to push to')
    .option('-f, --force', 'Skip confirmations')
    .description('Encrypt and upload environment variables')
    .action(pushCommand)
}
