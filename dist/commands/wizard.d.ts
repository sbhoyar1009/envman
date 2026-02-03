import { Command } from 'commander';
interface WizardOptions {
    quick?: boolean;
}
/**
 * Interactive setup wizard
 */
export declare function wizardCommand(options: WizardOptions): Promise<void>;
/**
 * Register wizard command with Commander
 */
export declare function registerWizardCommand(program: Command): void;
export {};
//# sourceMappingURL=wizard.d.ts.map