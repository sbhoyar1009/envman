import { Command } from 'commander'
import ora from 'ora'
import * as fs from 'fs'
import * as path from 'path'
import { configManager } from '../core/config-manager.js'
import { apiClient } from '../core/api-client.js'
import { logger } from '../utils/logger.js'
import { promptEmail, promptPassword, promptChoice, promptProjectName, promptProjectHash, promptPendingInvite } from '../utils/prompt.js'

/**
 * Login to envman account
 */
export async function loginCommand(): Promise<void> {
  try {
    logger.header('🔐 Login to EnvMan')

    // Check if already logged in
    if (configManager.isAuthenticated()) {
      const creds = configManager.getCredentials()
      logger.warn(`Already logged in as ${creds?.email}`)
      return
    }

    const email = await promptEmail()
    const password = await promptPassword()

    const spinner = ora('Logging in...').start()

    try {
      const response = await apiClient.login(email, password)

      // Save credentials
      configManager.saveCredentials({
        email: response.user.email,
        token: response.token,
        refreshToken: response.refreshToken,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
      })

      // Update API client with token
      apiClient.setToken(response.token)

      // Automatically configure Supabase if not already configured
      await autoConfigureSupabase()

      spinner.succeed('Successfully logged in!')
      logger.success(`Welcome, ${response.user.email}!`)

      // Post-login flow: Check for pending invites and offer project options
      await handlePostLoginFlow()

    } catch (error) {
      spinner.fail('Login failed')
      throw error
    }
  } catch (error) {
    logger.error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

/**
 * Handle post-login flow: Check pending invites and offer project options
 */
async function handlePostLoginFlow(): Promise<void> {
  try {
    logger.blank()
    logger.header('🚀 Getting Started')

    // Check for pending invites (with error handling)
    let pendingInvites: Array<{project: string, role: string, invitedBy: string, invitedAt: string}> = []
    try {
      pendingInvites = await apiClient.getPendingInvites()
    } catch (error) {
      logger.debug(`Could not fetch pending invites: ${error instanceof Error ? error.message : 'Unknown error'}`)
      // Continue without pending invites
    }

    if (pendingInvites.length > 0) {
      logger.info(`📨 You have ${pendingInvites.length} pending project invite(s)!`)
      const selectedProject = await promptPendingInvite(pendingInvites)

      if (selectedProject) {
        const spinner = ora(`Joining ${selectedProject}...`).start()
        try {
          await apiClient.acceptInvite(selectedProject)
          spinner.succeed(`Successfully joined ${selectedProject}!`)
          logger.info('✅ You can now push and pull environment variables for this project!')
          return
        } catch (error) {
          spinner.fail('Failed to join project')
          logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    // No pending invites or user skipped them - offer main options
    const action = await promptChoice(
      'What would you like to do?',
      [
        'Create a new project',
        'Join a project with invite hash',
        'Skip for now - I\'ll use existing projects'
      ]
    )

    switch (action) {
      case 'Create a new project':
        await handleCreateProject()
        break
      case 'Join a project with invite hash':
        await handleJoinByHash()
        break
      case 'Skip for now - I\'ll use existing projects':
        logger.info('✅ You can create or join projects later using the team commands!')
        logger.info('💡 Use "envman team --help" to see available options')
        break
    }

  } catch (error) {
    logger.warn(`Post-login setup skipped: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Handle creating a new project
 */
async function handleCreateProject(): Promise<void> {
  try {
    const projectName = await promptProjectName('my-project')
    const spinner = ora(`Creating project "${projectName}"...`).start()

    const result = await apiClient.createProject(projectName)

    spinner.succeed(result.message)
    logger.info('✅ Project created successfully!')
    logger.info(`🔗 Share this invite hash with your team: ${await getProjectHash(projectName)}`)
    logger.info('💡 You can now initialize your local project with: envman init')

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Failed to create project: ${errorMsg}`)
    
    // Provide specific guidance for schema cache issues
    if (errorMsg.includes('created_by') || errorMsg.includes('schema cache')) {
      logger.info('')
      logger.info('📋 Troubleshooting Tips:')
      logger.info('1. This is usually a Supabase schema cache issue')
      logger.info('2. Try restarting: npm run build')
      logger.info('3. See detailed fix: QUICK_FIX.md or FIX_SCHEMA_CACHE.md')
    }
  }
}

/**
 * Handle joining a project by hash
 */
async function handleJoinByHash(): Promise<void> {
  try {
    const hash = await promptProjectHash()
    const spinner = ora('Joining project...').start()

    const result = await apiClient.joinProjectByHash(hash)

    spinner.succeed(result.message)
    logger.info('✅ Successfully joined the project!')
    logger.info('💡 You can now push and pull environment variables for this project!')

  } catch (error) {
    logger.error(`Failed to join project: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get project invite hash (helper function)
 */
async function getProjectHash(projectName: string): Promise<string> {
  try {
    return await apiClient.getProjectHash(projectName)
  } catch (error) {
    return 'unable-to-retrieve-hash'
  }
}
export async function signupCommand(): Promise<void> {
  try {
    logger.header('📝 Sign Up for EnvMan')

    // Check if already logged in
    if (configManager.isAuthenticated()) {
      const creds = configManager.getCredentials()
      logger.warn(`Already logged in as ${creds?.email}`)
      logger.info('Use "envman logout" first if you want to create a different account')
      return
    }

    const email = await promptEmail()
    const password = await promptPassword('Choose a password:')

    // Confirm password
    const confirmPassword = await promptPassword('Confirm password:')
    if (password !== confirmPassword) {
      logger.error('Passwords do not match')
      process.exit(1)
    }

    // Validate password strength
    if (password.length < 8) {
      logger.error('Password must be at least 8 characters long')
      process.exit(1)
    }

    const spinner = ora('Creating your account...').start()

    try {
      logger.debug(`Starting signup process for ${email}`)
      const response = await apiClient.signup(email, password)
      logger.debug(`Signup API response: hasToken=${!!response.token}, userEmail=${response.user.email}`)

      // Check if we got a session token (immediate login successful)
      if (response.token) {
        logger.debug('Session token available - proceeding with full setup')
        configManager.saveCredentials({
          email: response.user.email,
          token: response.token,
          refreshToken: response.refreshToken,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        })

        // Update API client with token
        apiClient.setToken(response.token)

        // Automatically configure Supabase
        await autoConfigureSupabase()

        spinner.succeed('Account created successfully!')
        logger.success(`Welcome to EnvMan, ${response.user.email}!`)

        // Proceed with post-login flow
        await handlePostLoginFlow()
      } else {
        // No immediate session - user creation successful but needs email confirmation
        logger.debug('User created but no session token - email confirmation may be required')
        spinner.succeed('Account created!')
        logger.success(`Account created for ${email}`)
        logger.blank()
        logger.info('📧 Email Confirmation Required')
        logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        logger.info('Your account has been created but requires email verification.')
        logger.blank()
        logger.info('Options:')
        logger.info('1️⃣  Check your email for a verification link and click it')
        logger.info('2️⃣  Then run: envman login')
        logger.blank()
        logger.info('💡 For development: Email confirmation can be disabled in Supabase')
        logger.info('   See SUPABASE_SETUP.md for instructions')
        logger.blank()
      }
    } catch (error) {
      spinner.fail('Signup failed')
      logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  } catch (error) {
    logger.error(`Signup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

/**
 * Logout from envman
 */
export async function logoutCommand(): Promise<void> {
  try {
    if (!configManager.isAuthenticated()) {
      logger.warn('Not logged in')
      return
    }

    configManager.clearCredentials()
    apiClient.clearToken()
    logger.success('Successfully logged out')
  } catch (error) {
    logger.error(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

/**
 * Automatically configure Supabase for cloud sync
 */
async function autoConfigureSupabase(): Promise<void> {
  const envPath = path.join(process.cwd(), '.env')

  // Check if .env exists and has Supabase config
  let envContent = ''
  let hasSupabaseUrl = false
  let hasSupabaseKey = false

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8')
    hasSupabaseUrl = envContent.includes('SUPABASE_URL=')
    hasSupabaseKey = envContent.includes('SUPABASE_ANON_KEY=')
  }

  // If already configured, skip
  if (hasSupabaseUrl && hasSupabaseKey) {
    return
  }

  logger.info('🔧 Setting up cloud sync...')

  // Add default Supabase configuration
  const envLines = envContent.split('\n').filter(line => line.trim() !== '')

  // Remove any existing Supabase lines
  const filteredLines = envLines.filter(line =>
    !line.startsWith('SUPABASE_URL=') && !line.startsWith('SUPABASE_ANON_KEY=')
  )

  // Add default configuration
  filteredLines.push('# EnvMan Cloud Sync Configuration')
  filteredLines.push('SUPABASE_URL=https://envman.supabase.co')
  filteredLines.push('SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudm1hbiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQwMDAwMDAwLCJleHAiOjE5NTU1NjAwMDB9.default-anon-key-for-envman')

  // Write back to .env
  fs.writeFileSync(envPath, filteredLines.join('\n') + '\n')

  logger.success('✅ Cloud sync configured automatically!')
}

/**
 * Register login/logout commands with Commander
 */
export function registerAuthCommands(program: Command): void {
  program
    .command('signup')
    .description('Create a new EnvMan account')
    .action(signupCommand)

  program
    .command('login')
    .description('Login to your EnvMan account')
    .action(loginCommand)

  program
    .command('logout')
    .description('Logout from EnvMan')
    .action(logoutCommand)
}
