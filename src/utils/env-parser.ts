import * as fs from 'fs'
import * as path from 'path'
import { EnvVariable } from '../types/index.js'

/**
 * Parse .env file into key-value pairs
 */
export function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const vars: Record<string, string> = {}

  content.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      return
    }

    const [key, ...valueParts] = trimmed.split('=')
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim()
      // Remove quotes if present
      vars[key.trim()] = value.replace(/^['"]|['"]$/g, '')
    }
  })

  return vars
}

/**
 * Write variables to .env file
 */
export function writeEnvFile(filePath: string, vars: Record<string, string>): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const content = Object.entries(vars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  fs.writeFileSync(filePath, content + '\n', 'utf-8')
}

/**
 * Create .env.template file with keys only
 */
export function createTemplate(sourceFile: string, templateFile: string): void {
  const vars = parseEnvFile(sourceFile)
  const templateContent = Object.keys(vars)
    .map(key => `${key}=`)
    .join('\n')

  fs.writeFileSync(templateFile, templateContent + '\n', 'utf-8')
}

/**
 * Check if env file exists
 */
export function envFileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}

/**
 * Update .gitignore to include .env and .envman files
 */
export function updateGitignore(gitignorePath: string, entries: string[]): void {
  let content = ''

  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8')
  }

  const linesToAdd = entries.filter(entry => !content.includes(entry))

  if (linesToAdd.length > 0) {
    if (content && !content.endsWith('\n')) {
      content += '\n'
    }
    content += linesToAdd.join('\n') + '\n'
    fs.writeFileSync(gitignorePath, content, 'utf-8')
  }
}

/**
 * Get directory name from path
 */
export function getDirectoryName(): string {
  return path.basename(process.cwd())
}
