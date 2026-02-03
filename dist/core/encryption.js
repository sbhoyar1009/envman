import * as crypto from 'crypto';
/**
 * Manages encryption and decryption of environment variables
 */
export class EncryptionManager {
    constructor(projectName) {
        // For MVP, derive key from project name. In production, use user's master password
        this.derivationKey = projectName;
    }
    /**
     * Encrypt a single variable value
     */
    encryptValue(value) {
        const iv = crypto.randomBytes(16);
        const key = this.deriveKey();
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encryptedValue = cipher.update(value, 'utf8', 'hex');
        encryptedValue += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return {
            encryptedValue,
            iv: iv.toString('hex'),
            authTag
        };
    }
    /**
     * Decrypt a variable value
     */
    decryptValue(encryptedValue, iv, authTag) {
        const key = this.deriveKey();
        const ivBuffer = Buffer.from(iv, 'hex');
        const authTagBuffer = Buffer.from(authTag, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
        decipher.setAuthTag(authTagBuffer);
        let decryptedValue = decipher.update(encryptedValue, 'hex', 'utf8');
        decryptedValue += decipher.final('utf8');
        return decryptedValue;
    }
    /**
     * Derive encryption key from project name
     */
    deriveKey() {
        // Simple derivation: hash the project name to get a 256-bit key
        // In production: use a proper key derivation function like PBKDF2
        return crypto
            .createHash('sha256')
            .update(this.derivationKey)
            .digest();
    }
    /**
     * Check if a variable looks like a secret based on its name or value
     */
    looksLikeSecret(key, value) {
        const secretPatterns = [
            'secret',
            'password',
            'token',
            'key',
            'api_key',
            'access_key',
            'private_key',
            'auth',
            'credential',
            'apikey'
        ];
        const lowerKey = key.toLowerCase();
        const lowerValue = value.toLowerCase();
        return secretPatterns.some(pattern => lowerKey.includes(pattern) || lowerValue.includes(pattern));
    }
    /**
     * Encrypt multiple variables
     */
    encryptVariables(vars) {
        return Object.entries(vars).map(([key, value]) => {
            const { encryptedValue, iv, authTag } = this.encryptValue(value);
            return {
                key,
                encryptedValue,
                iv,
                authTag,
                isSecret: this.looksLikeSecret(key, value)
            };
        });
    }
    /**
     * Decrypt multiple variables
     */
    decryptVariables(encrypted) {
        const vars = {};
        encrypted.forEach(item => {
            try {
                vars[item.key] = this.decryptValue(item.encryptedValue, item.iv, item.authTag);
            }
            catch (error) {
                throw new Error(`Failed to decrypt variable ${item.key}`);
            }
        });
        return vars;
    }
}
//# sourceMappingURL=encryption.js.map