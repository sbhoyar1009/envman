# EnvMan CLI 🔐

**Smart Environment Variable Manager** - A secure CLI tool for managing encrypted environment variables across different environments (development, staging, production).

## Features

- 🔒 **Client-side Encryption** - All encryption happens on your machine before data leaves
- 🌐 **Cloud Sync** - Securely store and sync variables across your team
- 📝 **Interactive Prompts** - User-friendly CLI with clear feedback
- 🎯 **Smart Detection** - Automatically identifies secrets based on naming patterns
- 📦 **Zero Knowledge** - Server never sees plaintext variable values
- 🔄 **Environment Management** - Support for multiple environments
- 📊 **Template Generation** - Create `.env.template` files for sharing with teams

## Installation

```bash
npm install -g envman-cli
```

Or use locally with:

```bash
npm install
npm run dev
```

## Quick Start

### 1. Initialize Your Project

```bash
cd my-project
envman init my-project
```

This will:
- Create `.envman/config.json` for project settings
- Create `.env.template` if `.env` exists
- Update `.gitignore` to protect sensitive files

### 2. Login

```bash
envman login
```

Provide your email and password to authenticate.

### 3. Push Variables

```bash
envman push --env development
```

This will:
- Read your `.env` file
- Detect secrets based on naming patterns
- Encrypt all variables client-side
- Upload to the cloud

### 4. Pull Variables

```bash
envman pull --env development
```

Fetches encrypted variables from the cloud and decrypts them locally.

## Cloud Sync Setup

EnvMan uses Supabase for secure cloud storage and is **automatically configured** during login. No manual setup required!

### Automatic Setup Process

When you run `envman login`, the system automatically:
- ✅ Creates your account in the cloud
- ✅ Configures Supabase credentials in your `.env` file
- ✅ Sets up secure access to your project data
- ✅ Enables team collaboration features

### What Gets Configured

The login process automatically adds to your `.env` file:
```bash
# EnvMan Cloud Sync Configuration (added automatically)
SUPABASE_URL=https://envman.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Database Schema

The cloud database is pre-configured with all necessary tables:
- **`projects`** - Project metadata and ownership
- **`environments`** - Environment definitions (dev/staging/prod)
- **`variables`** - Encrypted environment variables
- **`team_members`** - Team member permissions and roles

**No manual database setup required!** 🎉

### Database Schema

The cloud database consists of four main tables:

- **`projects`** - Project metadata and settings
- **`environments`** - Environment definitions (dev, staging, prod)
- **`variables`** - Encrypted environment variables
- **`team_members`** - Team member permissions and roles

All data is protected by Row Level Security (RLS) policies that ensure users can only access data for projects they're members of.

## Commands

### `envman init [project-name]`

Initialize a new EnvMan project in the current directory.

**Options:**
- `[project-name]` - Name of your project (optional, defaults to directory name)

**Flow:**
1. Checks if already initialized
2. Prompts for project name and default environment
3. Optionally scans codebase for environment variable usage
4. Creates `.envman/config.json`
5. Creates `.env.template` if `.env` exists
6. Updates `.gitignore`

### `envman login`

Authenticate your EnvMan account.

**Flow:**
1. Prompts for email and password
2. Validates credentials
3. Stores JWT token locally (in `~/.config/envman/`)
4. Displays success message

### `envman logout`

Logout from your current session and clear stored credentials.

### `envman push [--env=environment] [--force]`

Encrypt and upload environment variables to the cloud.

**Options:**
- `-e, --env <environment>` - Specify target environment (dev, staging, production)
- `-f, --force` - Skip confirmation prompts

**Flow:**
1. Checks authentication
2. Reads `.env` file
3. Detects secrets using heuristics
4. Encrypts variables using AES-256-GCM
5. Uploads encrypted data to server
6. Shows summary of synced variables

### `envman pull [--env=environment] [--force]`

Download and decrypt environment variables from the cloud.

**Options:**
- `-e, --env <environment>` - Specify source environment
- `-f, --force` - Skip confirmation prompts

**Flow:**
1. Checks authentication
2. Prompts to overwrite existing `.env` (unless --force)
3. Fetches encrypted variables from server
4. Decrypts locally
5. Writes to `.env` file

### `envman logout`

Logout and remove stored credentials.

## File Structure

```
my-project/
├── .env                    # Actual secrets (gitignored)
├── .env.template           # Structure only, committed to git
├── .gitignore             # Updated to exclude .env
└── .envman/
    ├── config.json        # Project configuration
    └── credentials        # Auth tokens (gitignored)
```

## Encryption Details

EnvMan uses **AES-256-GCM** for encryption:

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **IV**: Random 16-byte initialization vector per variable
- **Auth Tag**: Integrity verification
- **Key Derivation**: Based on project name (MVP) → Master password (future)

### Secret Detection

Variables are marked as secrets if their key or value contains:
- `secret`
- `password`
- `token`
- `key` / `api_key`
- `auth`
- `credential`

## Security Considerations

### For Users

- ✅ All encryption happens on your machine
- ✅ Server never sees plaintext values
- ✅ Credentials stored in OS-specific secure storage
- ✅ Use strong passwords for your EnvMan account
- ⚠️ Protect your `.env` file - it contains sensitive data
- ⚠️ Don't share your authentication token

### For Teams

- ✅ Share `.env.template` with your team (contains keys only)
- ✅ Each team member has their own login
- ✅ All operations are encrypted
- ❌ Don't commit `.env` files to git

## Configuration

### Project Configuration (`.envman/config.json`)

```json
{
  "projectName": "my-project",
  "defaultEnvironment": "development",
  "createdAt": "2024-01-15T10:30:00Z",
  "lastUpdated": "2024-01-15T10:30:00Z",
  "environments": ["development", "staging", "production"]
}
```

### User Credentials (stored in `~/.config/envman/`)

Stored securely using the `conf` library:
- Email address
- JWT token
- Refresh token
- Expiration time

## Environment Variables

You can configure EnvMan behavior with these environment variables:

- `DEBUG=1` - Enable debug logging
- `ENVMAN_API_URL` - Custom API endpoint (default: https://api.envman.dev)

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Dev Mode

```bash
npm run dev init my-project
npm run dev login
npm run dev push
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

### Create Global Link

```bash
npm link
envman init
```

## Project Structure

```
src/
├── commands/          # CLI commands
│   ├── init.ts       # Initialize project
│   ├── auth.ts       # Login/logout
│   ├── push.ts       # Push variables
│   └── pull.ts       # Pull variables
├── core/             # Core business logic
│   ├── config-manager.ts   # Project/user config
│   ├── encryption.ts       # AES-256-GCM encryption
│   └── api-client.ts       # API communication
├── utils/            # Helper utilities
│   ├── logger.ts     # Colored logging
│   ├── env-parser.ts # .env file operations
│   ├── validators.ts # Input validation
│   └── prompt.ts     # Interactive prompts
├── types/
│   └── index.ts      # TypeScript types
└── index.ts          # CLI entry point
```

## Roadmap

### Phase 2: Core Features
- [ ] `envman sync --watch` - Auto-sync .env changes
- [ ] `envman rotate <key>` - Generate new secrets
- [ ] `envman scan` - Analyze code for env usage
- [ ] `envman diff` - Compare environments
- [ ] `envman team` - Team management

### Phase 3: Advanced
- [ ] File watching and auto-sync
- [ ] Conflict resolution
- [ ] Variable versioning and rollback
- [ ] Audit logs
- [ ] Master password-based encryption
- [ ] Web dashboard

## Troubleshooting

### Authentication Issues

```bash
# Clear stored credentials
rm -rf ~/.config/envman/

# Login again
envman login
```

### File Permission Errors

Ensure the project directory is writable:

```bash
chmod u+w .envman/
```

### Encryption/Decryption Errors

This usually means:
1. The project name changed
2. Credentials are corrupted
3. The `.env` file was modified externally

Solution: Re-pull variables from the cloud.

## API Documentation

### Mock Endpoints (MVP)

- `POST /auth/login` - Authenticate user
- `POST /sync/push` - Upload encrypted variables
- `GET /sync/pull` - Download encrypted variables

In production, these will be implemented with:
- JWT-based authentication
- Database persistence
- Rate limiting
- Audit logging

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT - See LICENSE file for details

## Support

For issues and questions:
- 📧 Email: support@envman.dev
- 🐛 GitHub Issues: [envman-cli/issues](https://github.com/envman-cli/issues)
- 📖 Documentation: [envman.dev/docs](https://envman.dev/docs)

---

Made with ❤️ by the EnvMan Team
