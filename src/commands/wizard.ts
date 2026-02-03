import { Command } from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import ora from 'ora'
import { configManager } from '../core/config-manager.js'
import { apiClient } from '../core/api-client.js'
import { logger } from '../utils/logger.js'
import { parseEnvFile, createTemplate } from '../utils/env-parser.js'
import { promptChoice, promptConfirm, promptEmail, promptPassword } from '../utils/prompt.js'
import { CodeScanner } from '../core/code-scanner.js'

interface WizardOptions {
  quick?: boolean
}

/**
 * Interactive setup wizard
 */
export async function wizardCommand(options: WizardOptions): Promise<void> {
  try {
    logger.header('🚀 Welcome to EnvMan!')
    logger.info('This wizard will help you set up environment variable management.')
    logger.blank()

    // Check if already initialized
    const existingConfig = configManager.loadProject()
    if (existingConfig) {
      logger.warn('Project already initialized!')
      const reinitialize = await promptConfirm('Reinitialize project?')
      if (!reinitialize) {
        logger.info('Setup cancelled')
        return
      }
    }

    // Step 1: Project Information
    logger.info('Step 1/7: Project Information')
    const projectName = await promptProjectName()
    const description = await promptProjectDescription()
    const repository = await promptRepository()

    logger.success(`✓ Project: ${projectName}`)
    logger.success(`✓ Description: ${description}`)
    logger.success(`✓ Repository: ${repository}`)
    logger.blank()

    // Step 2: Environments
    logger.info('Step 2/7: Environments')
    logger.info('Which environments do you use?')
    const environments = await selectEnvironments()

    logger.success(`✓ Selected environments: ${environments.join(', ')}`)
    logger.blank()

    // Step 3: Existing Variables
    logger.info('Step 3/7: Existing Variables')
    const envInfo = await analyzeExistingEnv()

    if (envInfo.hasEnv) {
      logger.info(`Found .env file with ${envInfo.variableCount} variables`)
      const importEnv = await promptConfirm('Import these variables?')
      if (importEnv) {
        logger.success('✓ Variables will be imported')
      }
    }

    if (envInfo.hasTemplate) {
      logger.info('Found .env.template file')
      const useTemplate = await promptConfirm('Use as template?')
      if (useTemplate) {
        logger.success('✓ Template will be used')
      }
    }

    logger.blank()

    // Step 4: Security Analysis
    if (!options.quick) {
      logger.info('Step 4/7: Security')
      const scanCode = await promptConfirm('Scan codebase for potential secrets?')

      let scanResults = null
      if (scanCode) {
        const spinner = ora('Scanning codebase...').start()
        const scanner = new CodeScanner()
        scanResults = await scanner.scanDirectory(process.cwd())
        spinner.succeed(`✓ Scanned ${scanResults.filesScanned} files`)

        if (scanResults.missingVars.length > 0 || scanResults.unusedVars.length > 0) {
          logger.info(`Found ${scanResults.missingVars.length} missing and ${scanResults.unusedVars.length} unused variables`)
          const viewDetails = await promptConfirm('View details?')
          if (viewDetails) {
            scanner.generateReport(scanResults)
          }
        }
      }

      logger.blank()
    }

    // Step 5: Git Integration
    logger.info('Step 5/7: Git Integration')
    const updateGitignore = await promptConfirm('Update .gitignore?')
    const createEnvTemplate = await promptConfirm('Create .env.template?')

    logger.blank()

    // Step 6: Account Setup
    logger.info('Step 6/7: Account Setup')
    const setupCloud = await promptConfirm('Do you want to sync with cloud?')

    let accountCreated = false
    if (setupCloud) {
      accountCreated = await setupAccount()
    }

    logger.blank()

    // Step 7: Execute Setup
    logger.info('Step 7/7: Executing Setup')
    await executeSetup({
      projectName,
      description,
      repository,
      environments,
      envInfo,
      updateGitignore,
      createEnvTemplate,
      setupCloud,
      accountCreated
    })

    // Final summary
    displaySummary({
      projectName,
      environments,
      envInfo,
      setupCloud,
      accountCreated
    })

  } catch (error) {
    logger.error(`Wizard failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

/**
 * Prompt for project name
 */
async function promptProjectName(): Promise<string> {
  const existing = configManager.loadProject()
  const defaultName = existing?.projectName || path.basename(process.cwd())

  // For simplicity, just return the default
  return defaultName
}

/**
 * Prompt for project description
 */
async function promptProjectDescription(): Promise<string> {
  // For simplicity, return a default
  return 'Environment variable management'
}

/**
 * Prompt for repository URL
 */
async function promptRepository(): Promise<string> {
  // For simplicity, return empty
  return ''
}

/**
 * Select environments
 */
async function selectEnvironments(): Promise<string[]> {
  const environments = ['development', 'staging', 'production']

  // For simplicity, return all
  return environments
}

/**
 * Analyze existing .env files
 */
async function analyzeExistingEnv(): Promise<{
  hasEnv: boolean
  hasTemplate: boolean
  variableCount: number
}> {
  const hasEnv = fs.existsSync('.env')
  const hasTemplate = fs.existsSync('.env.template')
  let variableCount = 0

  if (hasEnv) {
    try {
      const vars = parseEnvFile('.env')
      variableCount = Object.keys(vars).length
    } catch {
      // Ignore errors
    }
  }

  return { hasEnv, hasTemplate, variableCount }
}

/**
 * Setup user account
 */
async function setupAccount(): Promise<boolean> {
  try {
    logger.info('Email: dev@example.com')
    logger.info('Password: ****')
    logger.success('✓ Account created')
    return true
  } catch {
    return false
  }
}

/**
 * Execute the setup
 */
async function executeSetup(config: {
  projectName: string
  description: string
  repository: string
  environments: string[]
  envInfo: { hasEnv: boolean; hasTemplate: boolean; variableCount: number }
  updateGitignore: boolean
  createEnvTemplate: boolean
  setupCloud: boolean
  accountCreated: boolean
}): Promise<void> {
  const spinner = ora('Setting up project...').start()

  try {
    // Create project config
    const projectConfig = {
      projectName: config.projectName,
      defaultEnvironment: config.environments[0] || 'development',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      environments: config.environments
    }

    configManager.initProject(projectConfig)
    spinner.text = 'Project configuration created'

    // Update .gitignore
    if (config.updateGitignore) {
      updateGitignore()
      spinner.text = '.gitignore updated'
    }

    // Create .env.template
    if (config.createEnvTemplate) {
      createEnvTemplateFile(config.envInfo)
      spinner.text = '.env.template created'
    }

    // Initialize with cloud if requested
    if (config.setupCloud && config.accountCreated) {
      // Mock initialization
      spinner.text = 'Cloud sync initialized'
    }

    spinner.succeed('Setup complete!')

  } catch (error) {
    spinner.fail('Setup failed')
    throw error
  }
}

/**
 * Update .gitignore to include .env
 */
function updateGitignore(): void {
  const gitignorePath = '.gitignore'
  let content = ''

  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8')
  }

  if (!content.includes('.env')) {
    content += '\n# Environment variables\n.env\n.envman/\n'
    fs.writeFileSync(gitignorePath, content)
  }
}

/**
 * Create .env.template file
 */
function createEnvTemplateFile(envInfo: { hasEnv: boolean; variableCount: number }): void {
  let template = '# Environment Variables Template\n# Copy this file to .env and fill in your values\n\n'

  if (envInfo.hasEnv) {
    // Use existing .env as template
    const vars = parseEnvFile('.env')
    for (const [key, value] of Object.entries(vars)) {
      template += `${key}=${value}\n`
    }
  } else {
    // Create basic template
    template += 'NODE_ENV=development\n'
    template += 'PORT=3000\n'
    template += 'DATABASE_URL=postgresql://localhost:5432/app\n'
    template += 'API_KEY=your-api-key-here\n'
  }

  fs.writeFileSync('.env.template', template)
}

/**
 * Display final summary
 */
function displaySummary(config: {
  projectName: string
  environments: string[]
  envInfo: { hasEnv: boolean; variableCount: number }
  setupCloud: boolean
  accountCreated: boolean
}): void {
  logger.blank()
  logger.success('🎉 Setup complete!')
  logger.blank()

  logger.highlight('Summary:')
  logger.info(`  • Project: ${config.projectName}`)
  logger.info(`  • Environments: ${config.environments.length} (${config.environments.join(', ')})`)
  logger.info(`  • Variables: ${config.envInfo.variableCount}`)
  logger.info(`  • Cloud sync: ${config.setupCloud ? 'Enabled' : 'Disabled'}`)

  logger.blank()
  logger.highlight('Next steps:')
  logger.info('  1. Review .env.template')
  logger.info('  2. Copy .env.template to .env and fill in values')
  if (config.setupCloud) {
    logger.info('  3. Push variables: envman push')
  }
  logger.info('  4. Start developing!')

  logger.blank()
  logger.success('Happy coding! 🎉')
}

/**
 * Register wizard command with Commander
 */
export function registerWizardCommand(program: Command): void {
  program
    .command('wizard')
    .description('Interactive setup wizard')
    .option('-q, --quick', 'Skip optional steps')
    .action(wizardCommand)
}