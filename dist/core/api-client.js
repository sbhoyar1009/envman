import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { logger } from '../utils/logger.js';
/**
 * Handles all API communication with the backend
 */
export class APIClient {
    constructor(baseURL = 'https://api.envman.dev', token) {
        this.baseURL = baseURL;
        // Initialize Supabase client with default EnvMan instance
        // Users don't need to configure this - it's handled automatically
        const supabaseUrl = process.env.SUPABASE_URL || 'https://envman.supabase.co';
        const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudm1hbiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQwMDAwMDAwLCJleHAiOjE5NTU1NjAwMDB9.default-anon-key-for-envman';
        this.supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false
            }
        });
        // Set auth token if provided
        if (token) {
            // Set the session using the JWT token
            this.supabase.auth.setSession({
                access_token: token,
                refresh_token: '' // We don't have refresh token in this context
            });
        }
        this.client = axios.create({
            baseURL,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` })
            }
        });
    }
    /**
     * Mock delay to simulate network
     */
    async mockDelay() {
        return new Promise(resolve => setTimeout(resolve, 500));
    }
    /**
     * Login with email and password using Supabase
     */
    async login(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });
            if (error) {
                throw new Error(error.message);
            }
            if (!data.user || !data.session) {
                throw new Error('Login failed - no user session returned');
            }
            // Set the session in Supabase client
            await this.supabase.auth.setSession({
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token
            });
            logger.debug(`Successfully logged in user: ${data.user.email}`);
            return {
                token: data.session.access_token,
                refreshToken: data.session.refresh_token || '',
                user: {
                    email: data.user.email || email,
                    id: data.user.id
                }
            };
        }
        catch (error) {
            logger.error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    /**
     * Sign up with email and password using Supabase
     * After signup, auto-login to get session token
     */
    async signup(email, password) {
        try {
            logger.debug(`Attempting to sign up user: ${email}`);
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: undefined
                }
            });
            logger.debug(`Supabase signup response: user=${data?.user?.email || 'null'}, error=${error?.message || 'null'}`);
            if (error) {
                logger.error(`Supabase signup error: ${error.message}`);
                throw new Error(error.message);
            }
            if (!data.user) {
                logger.error('Signup failed - no user returned from Supabase');
                throw new Error('Signup failed - no user returned');
            }
            logger.debug(`User created successfully: ${data.user.email} (ID: ${data.user.id})`);
            // If we got a session immediately, use it
            if (data.session) {
                logger.debug('Session available immediately after signup');
                await this.supabase.auth.setSession({
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token || ''
                });
                // Create user profile with active session
                try {
                    logger.debug(`Creating user profile for ${data.user.email}`);
                    const { error: profileError } = await this.supabase
                        .from('user_profiles')
                        .upsert({
                        id: data.user.id,
                        email: data.user.email,
                        created_at: new Date().toISOString()
                    }, { onConflict: 'id' });
                    if (profileError) {
                        logger.warn(`Failed to create user profile: ${profileError.message}`);
                    }
                    else {
                        logger.debug(`User profile created successfully for ${data.user.email}`);
                    }
                }
                catch (profileError) {
                    logger.warn(`Error creating user profile: ${profileError instanceof Error ? profileError.message : 'Unknown error'}`);
                }
                return {
                    token: data.session.access_token,
                    refreshToken: data.session.refresh_token || '',
                    user: {
                        email: data.user.email || email,
                        id: data.user.id
                    }
                };
            }
            // No immediate session - try to login to get session (user might need email confirmation)
            logger.debug('No immediate session after signup - attempting auto-login');
            try {
                const loginResult = await this.login(email, password);
                logger.debug(`Auto-login after signup successful for ${email}`);
                // Create user profile after successful login
                try {
                    logger.debug(`Creating user profile for ${data.user.email}`);
                    const { error: profileError } = await this.supabase
                        .from('user_profiles')
                        .upsert({
                        id: data.user.id,
                        email: data.user.email,
                        created_at: new Date().toISOString()
                    }, { onConflict: 'id' });
                    if (profileError) {
                        logger.warn(`Failed to create user profile: ${profileError.message}`);
                    }
                    else {
                        logger.debug(`User profile created successfully for ${data.user.email}`);
                    }
                }
                catch (profileError) {
                    logger.warn(`Error creating user profile: ${profileError instanceof Error ? profileError.message : 'Unknown error'}`);
                }
                return loginResult;
            }
            catch (loginError) {
                logger.warn(`Auto-login after signup failed: ${loginError instanceof Error ? loginError.message : 'Unknown error'}`);
                // Return user info without token - client can handle pending confirmation
                return {
                    token: '',
                    refreshToken: '',
                    user: {
                        email: data.user.email || email,
                        id: data.user.id
                    }
                };
            }
        }
        catch (error) {
            logger.error(`Signup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    /**
     * Push encrypted variables to Supabase
     */
    async pushVariables(project, environment, variables) {
        try {
            const { data: { user }, error: userError } = await this.supabase.auth.getUser();
            if (userError || !user) {
                throw new Error('Not authenticated');
            }
            // Try to create project (will succeed if it doesn't exist, fail if it does)
            let projectId;
            try {
                const { data: newProject, error: createError } = await this.supabase
                    .from('projects')
                    .insert({
                    name: project,
                    created_by: user.id,
                    created_at: new Date().toISOString()
                })
                    .select('id')
                    .single();
                if (createError) {
                    // If it's a unique constraint error, the project already exists
                    if (createError.code === '23505') { // unique_violation
                        // Get the existing project
                        const { data: existingProject, error: selectError } = await this.supabase
                            .from('projects')
                            .select('id')
                            .eq('name', project)
                            .single();
                        if (selectError) {
                            throw new Error(`Failed to get existing project: ${selectError.message}`);
                        }
                        projectId = existingProject.id;
                    }
                    else {
                        throw new Error(`Failed to create project: ${createError.message}`);
                    }
                }
                else {
                    // Project was created successfully, now add the creator as owner
                    projectId = newProject.id;
                    const { error: memberError } = await this.supabase
                        .from('team_members')
                        .insert({
                        project_id: projectId,
                        user_id: user.id,
                        email: user.email,
                        role: 'owner',
                        status: 'active',
                        added_by: user.email,
                        added_at: new Date().toISOString()
                    });
                    if (memberError) {
                        logger.warn(`Failed to add project creator as owner: ${memberError.message}`);
                        // Don't fail the operation, just log the warning
                    }
                }
            }
            catch (error) {
                throw new Error(`Failed to ensure project exists: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            // Ensure environment exists
            const { data: envData, error: envError } = await this.supabase
                .from('environments')
                .select('id')
                .eq('project_id', projectId)
                .eq('name', environment)
                .single();
            if (envError && envError.code !== 'PGRST116') {
                throw new Error(`Failed to check environment: ${envError.message}`);
            }
            let environmentId;
            if (!envData) {
                // Create environment
                const { data: newEnv, error: createEnvError } = await this.supabase
                    .from('environments')
                    .insert({
                    project_id: projectId,
                    name: environment,
                    created_at: new Date().toISOString()
                })
                    .select('id')
                    .single();
                if (createEnvError) {
                    throw new Error(`Failed to create environment: ${createEnvError.message}`);
                }
                environmentId = newEnv.id;
            }
            else {
                environmentId = envData.id;
            }
            // Delete existing variables for this environment
            const { error: deleteError } = await this.supabase
                .from('variables')
                .delete()
                .eq('environment_id', environmentId);
            if (deleteError) {
                throw new Error(`Failed to clear existing variables: ${deleteError.message}`);
            }
            // Insert new variables
            const variablesToInsert = variables.map(v => ({
                environment_id: environmentId,
                key: v.key,
                encrypted_value: v.encryptedValue,
                iv: v.iv,
                auth_tag: v.authTag,
                is_secret: v.isSecret,
                created_at: new Date().toISOString()
            }));
            const { error: insertError } = await this.supabase
                .from('variables')
                .insert(variablesToInsert);
            if (insertError) {
                throw new Error(`Failed to insert variables: ${insertError.message}`);
            }
            logger.debug(`Successfully pushed ${variables.length} variables to ${project}/${environment}`);
            return {
                success: true,
                message: `Successfully pushed ${variables.length} variables`,
                data: variables
            };
        }
        catch (error) {
            logger.error(`Push failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    /**
     * Pull encrypted variables from Supabase
     */
    async pullVariables(project, environment) {
        try {
            // Get project
            const { data: projectData, error: projectError } = await this.supabase
                .from('projects')
                .select('id')
                .eq('name', project)
                .single();
            if (projectError) {
                if (projectError.code === 'PGRST116') {
                    // Project doesn't exist, return empty
                    return {
                        success: true,
                        message: 'Project not found, no variables to pull',
                        data: []
                    };
                }
                throw new Error(`Failed to find project: ${projectError.message}`);
            }
            // Get environment
            const { data: envData, error: envError } = await this.supabase
                .from('environments')
                .select('id')
                .eq('project_id', projectData.id)
                .eq('name', environment)
                .single();
            if (envError) {
                if (envError.code === 'PGRST116') {
                    // Environment doesn't exist, return empty
                    return {
                        success: true,
                        message: 'Environment not found, no variables to pull',
                        data: []
                    };
                }
                throw new Error(`Failed to find environment: ${envError.message}`);
            }
            // Get variables
            const { data: variables, error: varsError } = await this.supabase
                .from('variables')
                .select('*')
                .eq('environment_id', envData.id);
            if (varsError) {
                throw new Error(`Failed to fetch variables: ${varsError.message}`);
            }
            // Convert to EncryptedVariable format
            const encryptedVariables = (variables || []).map(v => ({
                key: v.key,
                encryptedValue: v.encrypted_value,
                iv: v.iv,
                authTag: v.auth_tag,
                isSecret: v.is_secret
            }));
            logger.debug(`Successfully pulled ${encryptedVariables.length} variables from ${project}/${environment}`);
            return {
                success: true,
                message: `Successfully pulled ${encryptedVariables.length} variables`,
                data: encryptedVariables
            };
        }
        catch (error) {
            logger.error(`Pull failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    /**
     * Update API token
     */
    setToken(token, refreshToken = '') {
        this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        // Also set the Supabase session with the token
        this.supabase.auth.setSession({
            access_token: token,
            refresh_token: refreshToken
        });
    }
    /**
     * Clear API token
     */
    clearToken() {
        delete this.client.defaults.headers.common['Authorization'];
    }
    /**
     * Get team configuration from Supabase
     */
    async getTeamConfig(project) {
        try {
            // Get project
            const { data: projectData, error: projectError } = await this.supabase
                .from('projects')
                .select('id')
                .eq('name', project)
                .single();
            if (projectError) {
                if (projectError.code === 'PGRST116') {
                    // Project doesn't exist, return default config
                    return this.getDefaultTeamConfig();
                }
                throw new Error(`Failed to find project: ${projectError.message}`);
            }
            // Get team members
            const { data: members, error: membersError } = await this.supabase
                .from('team_members')
                .select('*')
                .eq('project_id', projectData.id);
            if (membersError) {
                throw new Error(`Failed to fetch team members: ${membersError.message}`);
            }
            // Convert to TeamMember format
            const teamMembers = (members || []).map(m => ({
                email: m.email,
                role: m.role,
                addedAt: m.added_at,
                addedBy: m.added_by,
                status: m.status
            }));
            return {
                members: teamMembers,
                roles: {
                    owner: ['read', 'write', 'delete', 'manage_team', 'manage_project'],
                    admin: ['read', 'write', 'delete', 'manage_team'],
                    developer: ['read', 'write', 'sync'],
                    viewer: ['read']
                }
            };
        }
        catch (error) {
            logger.error(`Failed to get team config: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return this.getDefaultTeamConfig();
        }
    }
    /**
     * Get default team configuration
     */
    getDefaultTeamConfig() {
        return {
            members: [],
            roles: {
                owner: ['read', 'write', 'delete', 'manage_team', 'manage_project'],
                admin: ['read', 'write', 'delete', 'manage_team'],
                developer: ['read', 'write', 'sync'],
                viewer: ['read']
            }
        };
    }
    /**
     * Check if a project exists
     */
    async projectExists(projectName) {
        try {
            const { data, error } = await this.supabase
                .from('projects')
                .select('id')
                .eq('name', projectName)
                .single();
            return !error && !!data;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get the current authenticated user's email
     */
    async getCurrentUserEmail() {
        const { data: user, error } = await this.supabase.auth.getUser();
        if (error) {
            throw new Error(`Failed to get current user: ${error.message}`);
        }
        if (user?.user?.email) {
            return user.user.email;
        }
        throw new Error('No authenticated user found');
    }
    /**
     * Update team configuration in Supabase
     */
    async updateTeamConfig(project, teamConfig) {
        try {
            // Get project
            const { data: projectData, error: projectError } = await this.supabase
                .from('projects')
                .select('id')
                .eq('name', project)
                .single();
            if (projectError) {
                throw new Error(`Failed to find project: ${projectError.message}`);
            }
            // Delete existing team members
            const { error: deleteError } = await this.supabase
                .from('team_members')
                .delete()
                .eq('project_id', projectData.id);
            if (deleteError) {
                throw new Error(`Failed to clear existing team: ${deleteError.message}`);
            }
            // Insert new team members
            if (teamConfig.members.length > 0) {
                const membersToInsert = teamConfig.members.map(m => ({
                    project_id: projectData.id,
                    email: m.email,
                    role: m.role,
                    added_at: m.addedAt,
                    added_by: m.addedBy,
                    status: m.status
                }));
                const { error: insertError } = await this.supabase
                    .from('team_members')
                    .insert(membersToInsert);
                if (insertError) {
                    throw new Error(`Failed to insert team members: ${insertError.message}`);
                }
            }
            logger.debug(`Successfully updated team configuration for ${project}: ${teamConfig.members.length} members`);
            return {
                success: true,
                message: `Successfully updated team configuration`,
                data: teamConfig
            };
        }
        catch (error) {
            logger.error(`Failed to update team config: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    /**
     * Invite team member (add to database with pending status)
     */
    async inviteTeamMember(project, email, role) {
        try {
            // Get project
            const { data: projectData, error: projectError } = await this.supabase
                .from('projects')
                .select('id')
                .eq('name', project)
                .single();
            if (projectError) {
                throw new Error(`Failed to find project: ${projectError.message}`);
            }
            // Get current user
            const { data: { user }, error: userError } = await this.supabase.auth.getUser();
            if (userError || !user) {
                throw new Error('Not authenticated');
            }
            // Check if member already exists
            const { data: existing, error: checkError } = await this.supabase
                .from('team_members')
                .select('id')
                .eq('project_id', projectData.id)
                .eq('email', email)
                .single();
            if (checkError && checkError.code !== 'PGRST116') {
                throw new Error(`Failed to check existing member: ${checkError.message}`);
            }
            if (existing) {
                // Update existing member
                const { error: updateError } = await this.supabase
                    .from('team_members')
                    .update({
                    role: role,
                    status: 'pending',
                    added_at: new Date().toISOString(),
                    added_by: user.email
                })
                    .eq('id', existing.id);
                if (updateError) {
                    throw new Error(`Failed to update team member: ${updateError.message}`);
                }
            }
            else {
                // Insert new member
                const { error: insertError } = await this.supabase
                    .from('team_members')
                    .insert({
                    project_id: projectData.id,
                    email: email,
                    role: role,
                    added_at: new Date().toISOString(),
                    added_by: user.email || 'unknown',
                    status: 'pending'
                });
                if (insertError) {
                    throw new Error(`Failed to invite team member: ${insertError.message}`);
                }
            }
            logger.debug(`Successfully invited ${email} to ${project} as ${role}`);
            return {
                success: true,
                message: `Invitation sent to ${email}`,
                data: { email, role, status: 'pending' }
            };
        }
        catch (error) {
            logger.error(`Failed to invite team member: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    /**
     * Remove team member
     */
    async removeTeamMember(project, email) {
        try {
            // Get project
            const { data: projectData, error: projectError } = await this.supabase
                .from('projects')
                .select('id')
                .eq('name', project)
                .single();
            if (projectError) {
                throw new Error(`Failed to find project: ${projectError.message}`);
            }
            // Delete team member
            const { error: deleteError } = await this.supabase
                .from('team_members')
                .delete()
                .eq('project_id', projectData.id)
                .eq('email', email);
            if (deleteError) {
                throw new Error(`Failed to remove team member: ${deleteError.message}`);
            }
            logger.debug(`Successfully removed ${email} from ${project}`);
            return {
                success: true,
                message: `Successfully removed ${email} from team`,
                data: { email }
            };
        }
        catch (error) {
            logger.error(`Failed to remove team member: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    /**
     * Check user permissions for a project
     */
    async getUserPermissions(project, email) {
        try {
            const teamConfig = await this.getTeamConfig(project);
            const member = teamConfig.members.find(m => m.email === email && m.status === 'active');
            if (!member) {
                return []; // No permissions if not an active team member
            }
            return teamConfig.roles[member.role] || [];
        }
        catch (error) {
            logger.warn(`Could not verify permissions: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return [];
        }
    }
    /**
     * Get pending invites for the current user
     */
    async getPendingInvites() {
        try {
            const { data: { user }, error: userError } = await this.supabase.auth.getUser();
            if (userError || !user) {
                throw new Error('Not authenticated');
            }
            const { data: invites, error } = await this.supabase
                .from('team_members')
                .select(`
          role,
          added_by,
          added_at,
          projects!inner(name)
        `)
                .eq('email', user.email)
                .eq('status', 'pending');
            if (error) {
                throw new Error(`Failed to fetch pending invites: ${error.message}`);
            }
            return (invites || []).map(invite => ({
                project: invite.projects.name,
                role: invite.role,
                invitedBy: invite.added_by,
                invitedAt: invite.added_at
            }));
        }
        catch (error) {
            logger.error(`Failed to get pending invites: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return [];
        }
    }
    /**
     * Accept a pending invite
     */
    async acceptInvite(project) {
        try {
            const { data: { user }, error: userError } = await this.supabase.auth.getUser();
            if (userError || !user) {
                throw new Error('Not authenticated');
            }
            // Get project
            const { data: projectData, error: projectError } = await this.supabase
                .from('projects')
                .select('id')
                .eq('name', project)
                .single();
            if (projectError) {
                throw new Error(`Failed to find project: ${projectError.message}`);
            }
            // Update member status to active
            const { error: updateError } = await this.supabase
                .from('team_members')
                .update({ status: 'active' })
                .eq('project_id', projectData.id)
                .eq('email', user.email)
                .eq('status', 'pending');
            if (updateError) {
                throw new Error(`Failed to accept invite: ${updateError.message}`);
            }
            // Get the role for the response
            const { data: memberData, error: memberError } = await this.supabase
                .from('team_members')
                .select('role')
                .eq('project_id', projectData.id)
                .eq('email', user.email)
                .single();
            if (memberError) {
                throw new Error(`Failed to get member role: ${memberError.message}`);
            }
            logger.debug(`Successfully accepted invite for ${project}`);
            return {
                success: true,
                message: `Successfully joined ${project}`,
                data: { project, role: memberData.role }
            };
        }
        catch (error) {
            logger.error(`Failed to accept invite: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    /**
     * Join project by hash
     */
    async joinProjectByHash(hash) {
        try {
            const { data: { user }, error: userError } = await this.supabase.auth.getUser();
            if (userError || !user) {
                throw new Error('Not authenticated');
            }
            // Find project by hash
            const { data: projectData, error: projectError } = await this.supabase
                .from('projects')
                .select('id, name')
                .eq('invite_hash', hash)
                .single();
            if (projectError || !projectData) {
                throw new Error('Invalid or expired invite hash');
            }
            // Check if user is already a member
            const { data: existingMember, error: checkError } = await this.supabase
                .from('team_members')
                .select('id')
                .eq('project_id', projectData.id)
                .eq('email', user.email)
                .single();
            if (checkError && checkError.code !== 'PGRST116') {
                throw new Error(`Failed to check membership: ${checkError.message}`);
            }
            if (existingMember) {
                throw new Error('You are already a member of this project');
            }
            // Add user as member with default role
            const { error: insertError } = await this.supabase
                .from('team_members')
                .insert({
                project_id: projectData.id,
                email: user.email,
                role: 'developer', // Default role for hash joins
                added_at: new Date().toISOString(),
                added_by: 'system', // System added via hash
                status: 'active'
            });
            if (insertError) {
                throw new Error(`Failed to join project: ${insertError.message}`);
            }
            logger.debug(`Successfully joined ${projectData.name} via hash`);
            return {
                success: true,
                message: `Successfully joined ${projectData.name}`,
                data: { project: projectData.name, role: 'developer' }
            };
        }
        catch (error) {
            logger.error(`Failed to join project by hash: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    /**
     * Create a new project explicitly
     */
    async createProject(projectName) {
        try {
            const { data: { user }, error: userError } = await this.supabase.auth.getUser();
            if (userError || !user) {
                throw new Error('Not authenticated');
            }
            // Check if project already exists
            const existing = await this.projectExists(projectName);
            if (existing) {
                throw new Error(`Project '${projectName}' already exists`);
            }
            // Create project with created_by user ID
            const { data: newProject, error: createError } = await this.supabase
                .from('projects')
                .insert({
                name: projectName,
                created_by: user.id, // Link to authenticated user
                created_at: new Date().toISOString(),
                invite_hash: this.generateInviteHash() // Generate hash for sharing
            })
                .select('id')
                .single();
            if (createError) {
                // Check if it's a schema cache issue
                if (createError.message.includes('created_by') || createError.message.includes('schema cache')) {
                    logger.error('⚠️  Schema Cache Issue Detected!');
                    logger.error('This typically happens when the Supabase schema cache is outdated.');
                    logger.error('Try restarting the app:');
                    logger.error('  1. npm run build');
                    logger.error('  2. npm run dev signup');
                    logger.error('');
                    logger.error('If the issue persists, run diagnostic:');
                    logger.error('  See FIX_SCHEMA_CACHE.md for detailed troubleshooting steps');
                }
                throw new Error(`Failed to create project: ${createError.message}`);
            }
            // Add creator as owner
            const { error: memberError } = await this.supabase
                .from('team_members')
                .insert({
                project_id: newProject.id,
                user_id: user.id, // Link to authenticated user
                email: user.email,
                role: 'owner',
                status: 'active',
                added_by: user.email,
                added_at: new Date().toISOString()
            });
            if (memberError) {
                logger.warn(`Failed to add project creator as owner: ${memberError.message}`);
            }
            logger.debug(`Successfully created project: ${projectName}`);
            return {
                success: true,
                message: `Successfully created project '${projectName}'`,
                data: { project: projectName, role: 'owner' }
            };
        }
        catch (error) {
            logger.error(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    /**
     * Get project invite hash
     */
    async getProjectHash(projectName) {
        try {
            const { data: project, error } = await this.supabase
                .from('projects')
                .select('invite_hash')
                .eq('name', projectName)
                .single();
            if (error || !project?.invite_hash) {
                throw new Error('Project hash not found');
            }
            return project.invite_hash;
        }
        catch (error) {
            logger.error(`Failed to get project hash: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }
    /**
     * Generate a random invite hash
     */
    generateInviteHash() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    /**
     * Diagnose schema issues - check if table columns exist
     */
    async diagnoseSchema() {
        try {
            logger.info('Diagnosing database schema...');
            // Try to query the projects table with all expected columns
            const { data, error } = await this.supabase
                .from('projects')
                .select('id, name, created_by, invite_hash, created_at, updated_at')
                .limit(1);
            if (error) {
                logger.error(`❌ Schema Error: ${error.message}`);
                logger.error('   This might be a Supabase schema cache issue.');
                logger.error('   Try restarting the app: npm run build && npm run dev');
                return;
            }
            logger.success('✅ Projects table schema is correct');
            logger.info('All expected columns found: id, name, created_by, invite_hash, created_at, updated_at');
        }
        catch (error) {
            logger.error(`Diagnostic check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
export const apiClient = new APIClient();
//# sourceMappingURL=api-client.js.map