import * as crypto from 'crypto';
/**
 * Secret generation utilities
 */
export class SecretGenerator {
    /**
     * Generate a random UUID v4
     */
    generateUUID() {
        return crypto.randomUUID();
    }
    /**
     * Generate a random hex string
     */
    generateHex(length = 32) {
        return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
    }
    /**
     * Generate a random base64 string
     */
    generateBase64(length = 32) {
        return crypto.randomBytes(length).toString('base64').slice(0, length);
    }
    /**
     * Generate a random alphanumeric string
     */
    generateAlphanumeric(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    /**
     * Generate a JWT-compatible secret
     */
    generateJWTSecret(length = 64) {
        return this.generateHex(length);
    }
    /**
     * Generate a secret based on type
     */
    generate(type, length) {
        switch (type) {
            case 'uuid':
                return this.generateUUID();
            case 'hex':
                return this.generateHex(length);
            case 'base64':
                return this.generateBase64(length);
            case 'alphanumeric':
                return this.generateAlphanumeric(length);
            case 'jwt':
                return this.generateJWTSecret(length);
            default:
                return this.generateHex(length);
        }
    }
    /**
     * Check if a variable name looks like a secret
     */
    isLikelySecret(key) {
        const secretPatterns = [
            /secret/i,
            /key/i,
            /token/i,
            /password/i,
            /auth/i,
            /credential/i,
            /private/i,
            /api[_-]?key/i,
            /access[_-]?token/i,
            /refresh[_-]?token/i,
            /jwt[_-]?secret/i,
            /session[_-]?secret/i
        ];
        return secretPatterns.some(pattern => pattern.test(key));
    }
}
//# sourceMappingURL=secret-generator.js.map