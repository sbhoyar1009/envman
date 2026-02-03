import { Command } from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import ora from 'ora'
import inquirer from 'inquirer'
import { configManager } from '../core/config-manager.js'
import { apiClient, TeamMember as CloudTeamMember, TeamConfig as CloudTeamConfig } from '../core/api-client.js'
import { logger } from '../utils/logger.js'
import { promptChoice, promptConfirm } from '../utils/prompt.js'

interface TeamOptions {
  action?: 'list' | 'invite' | 'remove' | 'sync'
  email?: string
  role?: string
}

/**
 * Local team member information (cached version)
 */
interface LocalTeamMember {
  email: string
  role: string
  addedAt: string
  addedBy: string
  status?: 'active' | 'pending' | 'inactive'
}

/**
 * Local team configuration (cached version)
 */
interface LocalTeamConfig {
  members: LocalTeamMember[]
  roles: Record<string, string[]>
}

/**
 * Team management commands
 */
export async function teamCommand(options: TeamOptions): Promise<void> {
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

    // Check permissions for team management
    await configManager.requirePermission('manage_team', 'manage team members')

    logger.header('👥 Team Management')

    // Get API client
    const creds = configManager.getCredentials()
    apiClient.setToken(creds?.token || '')

    // Determine action
    let action = options.action
    if (!action) {
      action = await promptChoice('What would you like to do?', [
        'list',
        'invite',
        'remove',
        'sync'
      ]) as 'list' | 'invite' | 'remove' | 'sync'
    }

    switch (action) {
      case 'list':
        await listMembers(apiClient, projectConfig.projectName)
        break
      case 'invite':
        await inviteMember(apiClient, projectConfig.projectName, options.email, options.role)
        break
      case 'remove':
        await removeMember(apiClient, projectConfig.projectName, options.email)
        break
      case 'sync':
        await syncTeam(apiClient, projectConfig.projectName)
        break
      default:
        logger.error('Invalid action')
        process.exit(1)
    }

  } catch (error) {
    logger.error(`Team command failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

/**
 * List team members
 */
async function listMembers(client: typeof apiClient, project: string): Promise<void> {
  const spinner = ora('Loading team members...').start()

  try {
    const teamConfig = await client.getTeamConfig(project)
    spinner.succeed('Team members loaded')

    if (teamConfig.members.length === 0) {
      logger.info('No team members found')
      logger.info('💡 Invite team members with: envman team invite <email>')
      return
    }

    logger.info(`Team members (${teamConfig.members.length}):`)
    logger.blank()

    teamConfig.members.forEach((member, index) => {
      const statusIcon = member.status === 'active' ? '✓' : member.status === 'pending' ? '⏳' : '✗'
      logger.info(`${index + 1}. ${member.email} ${statusIcon}`)
      logger.dim(`   Role: ${member.role}`)
      logger.dim(`   Status: ${member.status}`)
      logger.dim(`   Added: ${new Date(member.addedAt).toLocaleDateString()}`)
      logger.dim(`   By: ${member.addedBy}`)
      logger.blank()
    })

    // Also show local cache if it exists
    const localConfig = loadLocalTeamConfig()
    if (localConfig.members.length > 0 && localConfig.members.length !== teamConfig.members.length) {
      logger.warn('⚠️  Local team cache may be out of sync')
      logger.info('💡 Run: envman team sync')
    }

  } catch (error) {
    spinner.fail('Failed to load team members')
    logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Invite a team member
 */
async function inviteMember(client: typeof apiClient, project: string, email?: string, role?: string): Promise<void> {
  if (!email) {
    const { inputEmail } = await inquirer.prompt([
      {
        type: 'input',
        name: 'inputEmail',
        message: 'Enter email address:',
        validate: (input: string) => {
          if (!input) return 'Email address is required'
          return true
        }
      }
    ])
    email = inputEmail
  }

  if (!role) {
    role = await promptChoice('Select role:', ['viewer', 'developer', 'admin'])
  }

  const spinner = ora(`Inviting ${email} as ${role}...`).start()

  try {
    // Send invitation via API
    await client.inviteTeamMember(project, email!, role!)

    // Update local cache
    const teamConfig = loadLocalTeamConfig()
    const existing = teamConfig.members.find(m => m.email === email)

    if (!existing) {
      const newMember: LocalTeamMember = {
        email: email!,
        role: role!,
        addedAt: new Date().toISOString(),
        addedBy: configManager.getCredentials()?.email || 'owner',
        status: 'pending'
      }
      teamConfig.members.push(newMember)
      saveLocalTeamConfig(teamConfig)
    }

    spinner.succeed(`✓ Invitation sent to ${email}`)
    logger.info(`Role: ${role}`)
    logger.info('💡 They will receive an email invitation to join the team')

  } catch (error) {
    spinner.fail('Failed to send invitation')
    logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Remove a team member
 */
async function removeMember(client: typeof apiClient, project: string, email?: string): Promise<void> {
  if (!email) {
    logger.error('Please specify an email address with --email')
    process.exit(1)
  }

  const confirm = await promptConfirm(`Remove ${email} from the team?`)
  if (!confirm) {
    logger.info('Cancelled')
    return
  }

  const spinner = ora(`Removing ${email} from team...`).start()

  try {
    // Remove via API
    await client.removeTeamMember(project, email)

    // Update local cache
    const teamConfig = loadLocalTeamConfig()
    const index = teamConfig.members.findIndex(m => m.email === email)

    if (index !== -1) {
      teamConfig.members.splice(index, 1)
      saveLocalTeamConfig(teamConfig)
    }

    spinner.succeed(`✓ Removed ${email} from the team`)

  } catch (error) {
    spinner.fail('Failed to remove team member')
    logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Sync team configuration with cloud
 */
async function syncTeam(client: typeof apiClient, project: string): Promise<void> {
  const spinner = ora('Syncing team configuration...').start()

  try {
    // Get latest from cloud
    const cloudConfig = await client.getTeamConfig(project)

    // Update local cache
    saveLocalTeamConfig(cloudConfig)

    spinner.succeed('✓ Team configuration synced')
    logger.info(`Synced ${cloudConfig.members.length} team members`)

  } catch (error) {
    spinner.fail('Failed to sync team configuration')
    logger.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Display available roles
 */
function displayRoles(): void {
  const teamConfig = loadLocalTeamConfig()

  logger.info('Available roles and permissions:')
  logger.blank()

  Object.entries(teamConfig.roles).forEach(([role, permissions]) => {
    logger.info(`• ${role}:`)
    permissions.forEach(permission => {
      logger.dim(`  - ${permission}`)
    })
    logger.blank()
  })
}

/**
 * Load team configuration from local cache
 */
function loadLocalTeamConfig(): LocalTeamConfig {
  const teamFile = path.join('.envman', 'team.json')

  if (!fs.existsSync(teamFile)) {
    // Create default config
    const defaultConfig: LocalTeamConfig = {
      members: [],
      roles: {
        owner: ['read', 'write', 'delete', 'manage_team', 'manage_project'],
        admin: ['read', 'write', 'delete', 'manage_team'],
        developer: ['read', 'write', 'sync'],
        viewer: ['read']
      }
    }
    saveLocalTeamConfig(defaultConfig)
    return defaultConfig
  }

  try {
    const content = fs.readFileSync(teamFile, 'utf-8')
    return JSON.parse(content)
  } catch {
    logger.warn('Could not load local team configuration, using defaults')
    return {
      members: [],
      roles: {
        owner: ['read', 'write', 'delete', 'manage_team', 'manage_project'],
        admin: ['read', 'write', 'delete', 'manage_team'],
        developer: ['read', 'write', 'sync'],
        viewer: ['read']
      }
    }
  }
}

/**
 * Save team configuration to local cache
 */
function saveLocalTeamConfig(config: LocalTeamConfig): void {
  const envmanDir = '.envman'
  if (!fs.existsSync(envmanDir)) {
    fs.mkdirSync(envmanDir, { recursive: true })
  }

  const teamFile = path.join(envmanDir, 'team.json')
  fs.writeFileSync(teamFile, JSON.stringify(config, null, 2))
}

/**
 * Register team command with Commander
 */
export function registerTeamCommand(program: Command): void {
  program
    .command('team')
    .description('Manage team members and permissions')
    .option('-a, --action <action>', 'Action: list, invite, remove, sync')
    .option('-e, --email <email>', 'Email address for invite/remove')
    .option('-r, --role <role>', 'Role for new member (viewer, developer, admin)')
    .action(teamCommand)
}