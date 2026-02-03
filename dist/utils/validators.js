/**
 * Validators for user input
 */
export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
export function validatePassword(password) {
    return password.length >= 8;
}
export function validateProjectName(name) {
    return /^[a-zA-Z0-9_-]+$/.test(name) && name.length > 0;
}
export function validateEnvironmentName(name) {
    return /^[a-z]+$/.test(name) && name.length > 0;
}
//# sourceMappingURL=validators.js.map