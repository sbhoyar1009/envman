#!/usr/bin/env node
import 'dotenv/config'; // Load environment variables
import { program } from 'commander';
import updateNotifier from 'update-notifier';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');
import { registerInitCommand } from './commands/init.js';
import { registerAuthCommands } from './commands/auth.js';
import { registerPushCommand } from './commands/push.js';
import { registerPullCommand } from './commands/pull.js';
import { registerDiffCommand } from './commands/diff.js';
import { registerScanCommand } from './commands/scan.js';
import { registerSyncCommand } from './commands/sync.js';
import { registerRotateCommand } from './commands/rotate.js';
import { registerValidateCommand } from './commands/validate.js';
import { registerWizardCommand } from './commands/wizard.js';
import { registerTeamCommand } from './commands/team.js';
// Check for updates
updateNotifier({ pkg: pkg }).notify();
// Setup program
program
    .name('envman')
    .description('🔐 Smart Environment Variable Manager - Secure CLI for managing encrypted environment variables')
    .version(pkg.version, '-v, --version');
// Register commands
registerInitCommand(program);
registerAuthCommands(program);
registerPushCommand(program);
registerPullCommand(program);
registerDiffCommand(program);
registerScanCommand(program);
registerSyncCommand(program);
registerRotateCommand(program);
registerValidateCommand(program);
registerWizardCommand(program);
registerTeamCommand(program);
// Help information
program
    .addHelpCommand('help [command]', 'Display help for command')
    .option('-d, --debug', 'Enable debug mode');
// Parse command line arguments
program.parse(process.argv);
// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
//# sourceMappingURL=index.js.map