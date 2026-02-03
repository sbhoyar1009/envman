/**
 * Validators for user input
 */

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePassword(password: string): boolean {
  return password.length >= 8
}

export function validateProjectName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name) && name.length > 0
}

export function validateEnvironmentName(name: string): boolean {
  return /^[a-z]+$/.test(name) && name.length > 0
}
