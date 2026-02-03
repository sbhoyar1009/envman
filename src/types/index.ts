/**
 * EnvMan CLI - Type Definitions
 */

/**
 * Represents a single environment variable
 */
export interface EnvVariable {
  key: string
  value: string
  isSecret?: boolean
  createdAt?: string
  updatedAt?: string
}

/**
 * Represents the project configuration
 */
export interface ProjectConfig {
  projectName: string
  defaultEnvironment: string
  createdAt: string
  lastUpdated: string
  environments: string[]
}

/**
 * Represents user credentials stored locally
 */
export interface UserCredentials {
  email: string
  token: string
  refreshToken: string
  expiresAt: number
}

/**
 * Represents encrypted variable data
 */
export interface EncryptedVariable {
  key: string
  encryptedValue: string
  iv: string
  authTag: string
  isSecret: boolean
}

/**
 * API response for login
 */
export interface LoginResponse {
  token: string
  refreshToken: string
  user: {
    email: string
    id: string
  }
}

/**
 * API response for push/pull operations
 */
export interface SyncResponse {
  success: boolean
  message: string
  data?: EncryptedVariable[]
}

/**
 * Configuration for CLI commands
 */
export interface CommandContext {
  configManager: any
  apiClient: any
  encryptionManager: any
  logger: any
}

/**
 * Diff result for comparing environments
 */
export interface DiffResult {
  added: string[]
  removed: string[]
  modified: Array<{
    key: string
    oldValue: string
    newValue: string
  }>
}
