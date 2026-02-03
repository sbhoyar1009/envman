# EnvMan CLI - GitHub Copilot Instructions

## Project Overview

EnvMan CLI is a TypeScript-based Node.js CLI tool for managing encrypted environment variables across different environments (development, staging, production). It provides secure client-side encryption, cloud synchronization, and team collaboration features.

## Architecture

### Technology Stack
- **Language**: TypeScript with strict mode
- **CLI Framework**: Commander.js
- **Encryption**: Node.js crypto (AES-256-GCM)
- **UI**: Inquirer for prompts, Chalk for colors, Ora for spinners
- **Config**: Conf library for secure credential storage
- **API**: Axios with mock implementation (MVP)

### Core Modules

1. **ConfigManager** (`src/core/config-manager.ts`)
   - Manages project and user configuration
   - Stores credentials securely in `~/.config/envman/`
   - Handles authentication state

2. **EncryptionManager** (`src/core/encryption.ts`)
   - Encrypts/decrypts variables using AES-256-GCM
   - Detects secrets using heuristics
   - Generates random IVs and auth tags

3. **APIClient** (`src/core/api-client.ts`)
   - Communicates with backend (mocked in MVP)
   - Handles authentication tokens
   - Supports push/pull operations

4. **Utilities**
   - `env-parser.ts`: Read/write/parse .env files
   - `logger.ts`: Consistent colored output
   - `prompt.ts`: Interactive user prompts
   - `validators.ts`: Input validation

## Development Guidelines

### Code Style
- Use TypeScript strict mode
- Follow ESLint configuration
- Use async/await (no callbacks)
- Add JSDoc comments for public functions
- Use const by default, avoid var

### Command Implementation Pattern

```typescript
export async function commandName(options?: Options): Promise<void> {
  try {
    // Validation checks
    if (!validation) {
      logger.error('Error message')
      process.exit(1)
    }

    // Main logic with ora spinners for async operations
    const spinner = ora('Doing something...').start()
    // ...
    spinner.succeed('Success!')

    // Display results with logger
    logger.success('Command completed')
  } catch (error) {
    logger.error(`Error: ${error.message}`)
    process.exit(1)
  }
}
```

### Adding New Commands

1. Create file in `src/commands/`
2. Export command function and registration function
3. Follow the pattern: `export async function commandName()`
4. Export registration: `export function registerCommandCommand(program: Command)`
5. Register in `src/index.ts`

### Error Handling
- Always catch errors and provide helpful messages
- Use logger.error() for user-facing errors
- Exit with process.exit(1) on fatal errors
- Include context in error messages

### File Operations
- Use fs synchronously for config files
- Always check file existence before reading
- Create directories with `{ recursive: true }`
- Update .gitignore when creating sensitive files

## Testing

Run tests with:
```bash
npm test
```

Test files should be in `tests/` directory with `.test.ts` extension.

## Building & Deployment

### Local Development
```bash
npm run dev init my-project
npm run dev login
npm run dev push
```

### Build for Distribution
```bash
npm run build
npm link  # Make available globally
envman init
```

## Current Implementation Status

### ✅ Completed
- Project structure and configuration
- Type definitions
- Logger and prompt utilities
- ConfigManager for credential storage
- EncryptionManager with AES-256-GCM
- APIClient with mock implementation
- Commands: init, login, logout, push, pull
- CLI entry point with Commander

### 📋 TODO (Future Phases)
- Unit tests for encryption and parsing
- Integration tests for commands
- File watching (sync --watch)
- Rotate command for secret regeneration
- Scan command for code analysis
- Diff command for environment comparison
- Team management commands
- Real backend API implementation
- Web dashboard
- Audit logging
- Version management

## Common Tasks

### Adding a New Command

1. Create `src/commands/newcommand.ts`
2. Implement command function and register function
3. Add to `src/index.ts` imports and registration
4. Test with `npm run dev newcommand`

### Updating Configuration
- Project config: `configManager.updateProject()`
- User credentials: `configManager.saveCredentials()`

### Error Cases
- Always validate authentication before operations
- Always check project initialization
- Validate file paths exist before operations
- Provide clear error messages with next steps

## Environment Setup

```bash
# Install dependencies
npm install

# Build project
npm run build

# Run specific command in development
npm run dev init my-project

# Link globally for testing
npm link
envman init
```

## Notes

- All encryption is currently based on project name (MVP). In production, use user's master password.
- API calls are mocked with timeouts. Real endpoints will be implemented later.
- Credentials are stored in `~/.config/envman/` using the `conf` library.
- .env files are gitignored automatically by the init command.
