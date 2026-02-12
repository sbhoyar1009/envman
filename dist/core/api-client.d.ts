import { LoginResponse, SyncResponse, EncryptedVariable } from '../types/index.js';
/**
 * Generic API response
 */
export interface APIResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
}
/**
 * Team member information
 */
export interface TeamMember {
    email: string;
    role: string;
    addedAt: string;
    addedBy: string;
    status: 'active' | 'pending' | 'inactive';
}
/**
 * Team configuration from cloud
 */
export interface TeamConfig {
    members: TeamMember[];
    roles: Record<string, string[]>;
}
/**
 * Handles all API communication with the backend
 */
export declare class APIClient {
    private client;
    private supabase;
    private baseURL;
    constructor(baseURL?: string, token?: string);
    /**
     * Mock delay to simulate network
     */
    private mockDelay;
    /**
     * Login with email and password using Supabase
     */
    login(email: string, password: string): Promise<LoginResponse>;
    /**
     * Sign up with email and password using Supabase
     * After signup, auto-login to get session token
     */
    signup(email: string, password: string): Promise<LoginResponse>;
    /**
     * Push encrypted variables to Supabase
     */
    pushVariables(project: string, environment: string, variables: EncryptedVariable[]): Promise<SyncResponse>;
    /**
     * Pull encrypted variables from Supabase
     */
    pullVariables(project: string, environment: string): Promise<SyncResponse>;
    /**
     * Update API token
     */
    setToken(token: string, refreshToken?: string): void;
    /**
     * Clear API token
     */
    clearToken(): void;
    /**
     * Get team configuration from Supabase
     */
    getTeamConfig(project: string): Promise<TeamConfig>;
    /**
     * Get default team configuration
     */
    private getDefaultTeamConfig;
    /**
     * Check if a project exists
     */
    projectExists(projectName: string): Promise<boolean>;
    /**
     * Get the current authenticated user's email
     */
    private getCurrentUserEmail;
    /**
     * Update team configuration in Supabase
     */
    updateTeamConfig(project: string, teamConfig: TeamConfig): Promise<APIResponse<TeamConfig>>;
    /**
     * Invite team member (add to database with pending status)
     */
    inviteTeamMember(project: string, email: string, role: string): Promise<APIResponse<{
        email: string;
        role: string;
        status: string;
    }>>;
    /**
     * Remove team member
     */
    removeTeamMember(project: string, email: string): Promise<APIResponse<{
        email: string;
    }>>;
    /**
     * Check user permissions for a project
     */
    getUserPermissions(project: string, email: string): Promise<string[]>;
    /**
     * Get pending invites for the current user
     */
    getPendingInvites(): Promise<Array<{
        project: string;
        role: string;
        invitedBy: string;
        invitedAt: string;
    }>>;
    /**
     * Accept a pending invite
     */
    acceptInvite(project: string): Promise<APIResponse<{
        project: string;
        role: string;
    }>>;
    /**
     * Join project by hash
     */
    joinProjectByHash(hash: string): Promise<APIResponse<{
        project: string;
        role: string;
    }>>;
    /**
     * Create a new project explicitly
     */
    createProject(projectName: string): Promise<APIResponse<{
        project: string;
        role: string;
    }>>;
    /**
     * Get project invite hash
     */
    getProjectHash(projectName: string): Promise<string>;
    /**
     * Generate a random invite hash
     */
    private generateInviteHash;
    /**
     * Diagnose schema issues - check if table columns exist
     */
    diagnoseSchema(): Promise<void>;
}
export declare const apiClient: APIClient;
//# sourceMappingURL=api-client.d.ts.map