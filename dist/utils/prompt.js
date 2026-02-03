import inquirer from 'inquirer';
import { validateEmail, validatePassword } from './validators.js';
/**
 * Prompt for user email
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
    return email;
}
/**
 * Prompt for password
 */
export async function promptPassword() {
    const { password } = await inquirer.prompt([
        {
            type: 'password',
            name: 'password',
            message: 'Enter your password:',
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
//# sourceMappingURL=prompt.js.map