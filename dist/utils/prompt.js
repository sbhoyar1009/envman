import inquirer from 'inquirer';
import { validateEmail, validatePassword } from './validators.js';
/**
 * Prompt for email
 */
export async function promptEmail() {
    const { email } = await inquirer.prompt([
        {
            type: 'input',
            name: 'email',
            message: 'Enter your email:',
            validate: (input) => {
                if (!input)
                    return 'Email is required';
                if (!validateEmail(input))
                    return 'Please enter a valid email address';
                return true;
            }
        }
    ]);
    return email.trim();
}
/**
 * Prompt for password
 */
export async function promptPassword(message = 'Enter your password:') {
    const { password } = await inquirer.prompt([
        {
            type: 'password',
            name: 'password',
            message,
            mask: '*',
            validate: (input) => {
                if (!input)
                    return 'Password is required';
                if (!validatePassword(input))
                    return 'Password must be at least 8 characters';
                return true;
            }
        }
    ]);
    return password;
}
/**
 * Prompt for confirmation
 */
export async function promptConfirm(message) {
    const { confirmed } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmed',
            message,
            default: false
        }
    ]);
    return confirmed;
}
/**
 * Prompt for project name
 */
export async function promptProjectName(defaultName) {
    const { projectName } = await inquirer.prompt([
        {
            type: 'input',
            name: 'projectName',
            message: 'Project name:',
            default: defaultName,
            validate: (input) => {
                if (!input)
                    return 'Project name is required';
                if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
                    return 'Project name can only contain letters, numbers, hyphens, and underscores';
                }
                return true;
            }
        }
    ]);
    return projectName;
}
/**
 * Prompt for environment selection
 */
export async function promptEnvironment(defaultEnv, choices = ['development', 'staging', 'production']) {
    const { environment } = await inquirer.prompt([
        {
            type: 'list',
            name: 'environment',
            message: 'Default environment:',
            choices,
            default: defaultEnv
        }
    ]);
    return environment;
}
/**
 * Prompt for multiple choice
 */
export async function promptChoice(message, choices, defaultChoice) {
    const { choice } = await inquirer.prompt([
        {
            type: 'list',
            name: 'choice',
            message,
            choices,
            default: defaultChoice
        }
    ]);
    return choice;
}
/**
 * Prompt for multiple selections
 */
export async function promptCheckbox(message, choices) {
    const { selected } = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'selected',
            message,
            choices
        }
    ]);
    return selected;
}
/**
 * Prompt for project hash input
 */
export async function promptProjectHash() {
    const { hash } = await inquirer.prompt([
        {
            type: 'input',
            name: 'hash',
            message: 'Enter project invite hash:',
            validate: (input) => {
                if (!input)
                    return 'Invite hash is required';
                if (!/^[a-zA-Z0-9]+$/.test(input)) {
                    return 'Invite hash can only contain letters and numbers';
                }
                return true;
            }
        }
    ]);
    return hash;
}
/**
 * Prompt to select from pending invites
 */
export async function promptPendingInvite(invites) {
    if (invites.length === 0) {
        return null;
    }
    const choices = invites.map(invite => ({
        name: `${invite.project} (invited by ${invite.invitedBy} as ${invite.role})`,
        value: invite.project
    }));
    choices.push({
        name: 'Skip - I\'ll join later',
        value: 'skip'
    });
    const { selectedProject } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selectedProject',
            message: 'You have pending invites. Which project would you like to join?',
            choices
        }
    ]);
    return selectedProject === 'skip' ? null : selectedProject;
}
//# sourceMappingURL=prompt.js.map