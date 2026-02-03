/**
 * Secret generation utilities
 */
export declare class SecretGenerator {
    /**
     * Generate a random UUID v4
     */
    generateUUID(): string;
    /**
     * Generate a random hex string
     */
    generateHex(length?: number): string;
    /**
     * Generate a random base64 string
     */
    generateBase64(length?: number): string;
    /**
     * Generate a random alphanumeric string
     */
    generateAlphanumeric(length?: number): string;
    /**
     * Generate a JWT-compatible secret
     */
    generateJWTSecret(length?: number): string;
    /**
     * Generate a secret based on type
     */
    generate(type: 'uuid' | 'hex' | 'base64' | 'alphanumeric' | 'jwt', length?: number): string;
    /**
     * Check if a variable name looks like a secret
     */
    isLikelySecret(key: string): boolean;
}
//# sourceMappingURL=secret-generator.d.ts.map