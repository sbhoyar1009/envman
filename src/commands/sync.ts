import { Command } from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import ora from 'ora'
import { configManager } from '../core/config-manager.js'
import { apiClient } from '../core/api-client.js'
import { EncryptionManager } from '../core/encryption.js'
import { logger } from '../utils/logger.js'
import { parseEnvFile } from '../utils/env-parser.js'
import { FileWatcher, EnvChangeInfo } from '../core/file-watcher.js'

interface SyncOptions {
  watch?: boolean
  pushOnly?: boolean
  pullOnly?: boolean
  interval?: number
  env?: string
}

/**
 * Auto-sync environment variables
 */
export async function syncCommand(options: SyncOptions): Promise<void> {
  try {
    // Check authentication
    if (!configManager.isAuthenticated()) {
      logger.error('Not authenticated. Please run: envman login')
      process.exit(1)
    }

    // Get and set user credentials to API client
    const credentials = configManager.getCredentials()
    if (!credentials) {
      logger.error('Failed to retrieve credentials')
      process.exit(1)
    }
    apiClient.setToken(credentials.token, credentials.refreshToken)

    // Check project initialization
    const projectConfig = configManager.loadProject()
    if (!projectConfig) {
      logger.error('Project not initialized. Please run: envman init')
      process.exit(1)
    }

    // Check permissions
    await configManager.requirePermission('sync', 'sync environment variables')

    const environment = options.env || 'development'
    const envFile = '.env'

    // Check if .env file exists
    if (!fs.existsSync(envFile)) {
      logger.error(`Local .env file not found: ${envFile}`)
      process.exit(1)
    }

    logger.header('🔄 Environment Auto-Sync')

    if (options.watch) {
      await startWatchMode(environment, envFile, options)
    } else {
      await performOneTimeSync(environment, envFile, options)
    }

  } catch (error) {
    logger.error(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

/**
 * Start watch mode for continuous syncing
 */
async function startWatchMode(environment: string, envFile: string, options: SyncOptions): Promise<void> {
  const { pushOnly = false, pullOnly = false, interval = 60 } = options

  logger.info('🔄 Sync mode active - watching for changes...')
  logger.info(`  Local:  ${envFile}`)
  logger.info(`  Remote: ${environment} environment`)
  logger.blank()
  logger.info('Press Ctrl+C to stop')
  logger.blank()

  const watcher = new FileWatcher()
  let pollTimer: NodeJS.Timeout | null = null

  // Handle local file changes
  watcher.on('env-changed', async (changes: EnvChangeInfo) => {
    if (pullOnly) return // Skip if pull-only mode

    logger.info(`📝 Local change detected at ${changes.timestamp.toLocaleTimeString()}`)
    if (changes.variables.added.length > 0) {
      logger.dim(`           Added: ${changes.variables.added.join(', ')}`)
    }
    if (changes.variables.modified.length > 0) {
      logger.dim(`           Modified: ${changes.variables.modified.join(', ')}`)
    }
    if (changes.variables.removed.length > 0) {
      logger.dim(`           Removed: ${changes.variables.removed.join(', ')}`)
    }

    await performPush(environment, envFile, 'Local changes detected')
  })

  // Handle errors
  watcher.on('error', (error) => {
    logger.error(`Watcher error: ${error}`)
  })

  // Start watching
  watcher.watch(envFile)

  // Start polling for remote changes (unless push-only)
  if (!pushOnly) {
    pollTimer = setInterval(async () => {
      try {
        await checkRemoteChanges(environment, envFile)
      } catch (error) {
        logger.debug(`Poll error: ${error}`)
      }
    }, interval * 1000)

    logger.debug(`Started polling every ${interval} seconds`)
  }

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('\n🛑 Stopping sync mode...')
    watcher.stop()
    if (pollTimer) {
      clearInterval(pollTimer)
    }
    process.exit(0)
  })

  // Keep the process running
  await new Promise(() => {}) // Never resolves, waits for SIGINT
}

/**
 * Perform one-time sync operation
 */
async function performOneTimeSync(environment: string, envFile: string, options: SyncOptions): Promise<void> {
  const { pushOnly = false, pullOnly = false } = options

  if (!pushOnly && !pullOnly) {
    // Bidirectional sync - push then pull
    await performPush(environment, envFile, 'One-time sync')
    await performPull(environment, envFile)
  } else if (pushOnly) {
    await performPush(environment, envFile, 'Push-only sync')
  } else if (pullOnly) {
    await performPull(environment, envFile)
  }
}

/**
 * Push local changes to remote
 */
async function performPush(environment: string, envFile: string, reason: string): Promise<void> {
  const spinner = ora('Pushing to cloud...').start()

  try {
    // Parse and encrypt variables
    const variables = parseEnvFile(envFile)
    const encryption = new EncryptionManager(configManager.loadProject()!.projectName)
    const encryptedVars = encryption.encryptVariables(variables)

    // Push to API
    const response = await apiClient.pushVariables(
      configManager.loadProject()!.projectName,
      environment,
      encryptedVars
    )

    if (!response.success) {
      throw new Error(response.message)
    }

    spinner.succeed(`✓ Synced ${encryptedVars.length} variables (${reason})`)

  } catch (error) {
    spinner.fail('Push failed')
    throw error
  }
}

/**
 * Pull remote changes
 */
async function performPull(environment: string, envFile: string): Promise<void> {
  const spinner = ora('Checking for remote changes...').start()

  try {
    // Get remote variables
    const response = await apiClient.pullVariables(
      configManager.loadProject()!.projectName,
      environment
    )

    if (!response.success || !response.data) {
      spinner.info('No remote changes found')
      return
    }

    // Decrypt variables
    const encryption = new EncryptionManager(configManager.loadProject()!.projectName)
    const remoteVars = encryption.decryptVariables(response.data)

    // Compare with local
    const localVars = parseEnvFile(envFile)
    const hasChanges = Object.keys(remoteVars).some(key =>
      !(key in localVars) || localVars[key] !== remoteVars[key]
    )

    if (!hasChanges) {
      spinner.info('No changes detected')
      return
    }

    spinner.text = 'Remote changes found - pulling...'

    // Write to local file
    const envContent = Object.entries(remoteVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n'

    fs.writeFileSync(envFile, envContent)

    spinner.succeed(`✓ Pulled ${Object.keys(remoteVars).length} variables`)

  } catch (error) {
    spinner.fail('Pull failed')
    throw error
  }
}

/**
 * Check for remote changes during polling
 */
async function checkRemoteChanges(environment: string, envFile: string): Promise<void> {
  try {
    const response = await apiClient.pullVariables(
      configManager.loadProject()!.projectName,
      environment
    )

    if (!response.success || !response.data) {
      return // No remote data
    }

    const encryption = new EncryptionManager(configManager.loadProject()!.projectName)
    const remoteVars = encryption.decryptVariables(response.data)
    const localVars = parseEnvFile(envFile)

    // Check if remote has new/changed variables
    const hasNewOrChanged = Object.entries(remoteVars).some(([key, value]) => {
      return !(key in localVars) || localVars[key] !== value
    })

    if (hasNewOrChanged) {
      logger.info(`📥 Remote change detected at ${new Date().toLocaleTimeString()}`)

      // Show what changed
      const added = Object.keys(remoteVars).filter(key => !(key in localVars))
      const modified = Object.keys(remoteVars).filter(key =>
        key in localVars && localVars[key] !== remoteVars[key]
      )

      if (added.length > 0) {
        logger.dim(`           Added: ${added.join(', ')}`)
      }
      if (modified.length > 0) {
        logger.dim(`           Modified: ${modified.join(', ')}`)
      }

      // Auto-pull the changes
      await performPull(environment, envFile)
    }

  } catch (error) {
    // Silent fail for polling
    logger.debug(`Remote check failed: ${error}`)
  }
}

/**
 * Register sync command with Commander
 */
export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Auto-sync environment variables with cloud')
    .option('-w, --watch', 'Watch mode for continuous syncing')
    .option('--push-only', 'Only watch local → cloud')
    .option('--pull-only', 'Only watch cloud → local')
    .option('-i, --interval <seconds>', 'Poll interval in seconds (default: 60)', parseInt)
    .option('-e, --env <environment>', 'Environment to sync with (default: development)')
    .action(syncCommand)
}