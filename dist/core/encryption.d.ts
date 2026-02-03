import { EncryptedVariable } from '../types/index.js';
/**
 * Manages encryption and decryption of environment variables
 */
export declare class EncryptionManager {
    private derivationKey;
    constructor(projectName: string);
    /**
     * Encrypt a single variable value
     */
    private encryptValue;
    /**
     * Decrypt a variable value
     */
    private decryptValue;
    /**
     * Derive encryption key from project name
     */
    private deriveKey;
    /**
     * Check if a variable looks like a secret based on its name or value
     */
    looksLikeSecret(key: string, value: string): boolean;
    /**
     * Encrypt multiple variables
     */
    encryptVariables(vars: Record<string, string>): EncryptedVariable[];
    /**
     * Decrypt multiple variables
     */
    decryptVariables(encrypted: EncryptedVariable[]): Record<string, string>;
}
//# sourceMappingURL=encryption.d.ts.map