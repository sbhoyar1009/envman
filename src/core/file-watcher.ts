import * as fs from 'fs'
import * as path from 'path'
import { EventEmitter } from 'events'
import chokidar from 'chokidar'
import { logger } from '../utils/logger.js'

/**
 * File change information
 */
export interface FileChangeInfo {
  type: 'added' | 'changed' | 'deleted'
  path: string
  timestamp: Date
  content?: string
}

/**
 * Environment variable change information
 */
export interface EnvChangeInfo {
  type: 'added' | 'modified' | 'removed'
  variables: {
    added: string[]
    modified: string[]
    removed: string[]
  }
  timestamp: Date
}

/**
 * File watcher for monitoring .env files
 */
export class FileWatcher extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null
  private debounceTimer: NodeJS.Timeout | null = null
  private lastContent: string = ''
  private readonly debounceDelay: number = 2000 // 2 seconds

  /**
   * Start watching a file
   */
  watch(filePath: string): void {
    if (this.watcher) {
      this.stop()
    }

    logger.debug(`Starting file watcher for: ${filePath}`)

    // Read initial content
    try {
      this.lastContent = fs.readFileSync(filePath, 'utf-8')
    } catch (error) {
      logger.warn(`Could not read initial file content: ${filePath}`)
      this.lastContent = ''
    }

    // Start watching
    this.watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    })

    this.watcher.on('change', (path) => {
      logger.debug(`File change detected: ${path}`)
      this.handleFileChange(path)
    })

    this.watcher.on('error', (error) => {
      logger.error(`File watcher error: ${error.message}`)
      this.emit('error', error)
    })

    this.emit('started', filePath)
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
      logger.debug('File watcher stopped')
      this.emit('stopped')
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  /**
   * Handle file change with debouncing
   */
  private handleFileChange(filePath: string): void {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    // Set new timer
    this.debounceTimer = setTimeout(() => {
      this.processFileChange(filePath)
    }, this.debounceDelay)
  }

  /**
   * Process the actual file change
   */
  private processFileChange(filePath: string): void {
    try {
      const newContent = fs.readFileSync(filePath, 'utf-8')
      const changes = this.calculateChanges(this.lastContent, newContent)

      if (changes.variables.added.length > 0 ||
          changes.variables.modified.length > 0 ||
          changes.variables.removed.length > 0) {

        logger.debug(`Environment variables changed: +${changes.variables.added.length} -${changes.variables.removed.length} ~${changes.variables.modified.length}`)

        this.lastContent = newContent
        this.emit('env-changed', changes)
      }

    } catch (error) {
      logger.error(`Error processing file change: ${error}`)
      this.emit('error', error)
    }
  }

  /**
   * Calculate what changed between two .env file contents
   */
  private calculateChanges(oldContent: string, newContent: string): EnvChangeInfo {
    const oldVars = this.parseEnvContent(oldContent)
    const newVars = this.parseEnvContent(newContent)

    const added: string[] = []
    const modified: string[] = []
    const removed: string[] = []

    // Find added and modified
    for (const [key, value] of Object.entries(newVars)) {
      if (!(key in oldVars)) {
        added.push(key)
      } else if (oldVars[key] !== value) {
        modified.push(key)
      }
    }

    // Find removed
    for (const key of Object.keys(oldVars)) {
      if (!(key in newVars)) {
        removed.push(key)
      }
    }

    return {
      type: added.length > 0 || removed.length > 0 ? 'modified' : 'added',
      variables: { added, modified, removed },
      timestamp: new Date()
    }
  }

  /**
   * Parse .env file content into key-value pairs
   */
  private parseEnvContent(content: string): Record<string, string> {
    const vars: Record<string, string> = {}

    content.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key) {
          vars[key.trim()] = valueParts.join('=').trim()
        }
      }
    })

    return vars
  }

  /**
   * Get current file hash for comparison
   */
  getFileHash(filePath: string): string {
    try {
      const crypto = require('crypto')
      const content = fs.readFileSync(filePath)
      return crypto.createHash('md5').update(content).digest('hex')
    } catch {
      return ''
    }
  }
}