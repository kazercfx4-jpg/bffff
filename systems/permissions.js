const { PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

class PermissionSystem {
    constructor() {
        this.permissions = new Map();
        this.roles = new Map();
        this.userRoles = new Map();
        this.commandPermissions = new Map();
        this.loadConfiguration();
        this.initializeDefaultRoles();
        this.initializeCommandPermissions();
    }

    loadConfiguration() {
        try {
            const configPath = path.join(__dirname, '..', 'data', 'permissions.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                this.permissions = new Map(config.permissions || []);
                this.roles = new Map(config.roles || []);
                this.userRoles = new Map(config.userRoles || []);
                this.commandPermissions = new Map(config.commandPermissions || []);
            }
        } catch (error) {
            console.error('Erreur chargement permissions:', error);
        }
    }

    saveConfiguration() {
        try {
            const configPath = path.join(__dirname, '..', 'data', 'permissions.json');
            const config = {
                permissions: Array.from(this.permissions.entries()),
                roles: Array.from(this.roles.entries()),
                userRoles: Array.from(this.userRoles.entries()),
                commandPermissions: Array.from(this.commandPermissions.entries())
            };
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('Erreur sauvegarde permissions:', error);
        }
    }

    initializeDefaultRoles() {
        // Rôle Super Admin
        this.roles.set('superadmin', {
            name: 'Super Administrateur',
            color: '#ff0000',
            permissions: [
                'system.manage',
                'system.maintenance',
                'system.backup',
                'user.manage',
                'user.ban',
                'user.roles',
                'obfuscation.unlimited',
                'economy.manage',
                'tickets.manage',
                'notifications.manage',
                'moderation.all',
                'ai.configure',
                'webhooks.manage'
            ],
            priority: 100,
            description: 'Accès complet à toutes les fonctionnalités'
        });

        // Rôle Admin
        this.roles.set('admin', {
            name: 'Administrateur',
            color: '#ff9900',
            permissions: [
                'user.manage',
                'user.ban',
                'obfuscation.advanced',
                'economy.view',
                'tickets.manage',
                'moderation.all',
                'ai.use'
            ],
            priority: 90,
            description: 'Gestion des utilisateurs et modération'
        });

        // Rôle Modérateur
        this.roles.set('moderator', {
            name: 'Modérateur',
            color: '#3498db',
            permissions: [
                'user.warn',
                'user.mute',
                'user.kick',
                'obfuscation.premium',
                'tickets.view',
                'moderation.basic',
                'ai.use'
            ],
            priority: 80,
            description: 'Modération et support utilisateurs'
        });

        // Rôle Support
        this.roles.set('support', {
            name: 'Support',
            color: '#9932cc',
            permissions: [
                'tickets.respond',
                'tickets.view',
                'user.view',
                'obfuscation.basic',
                'ai.use'
            ],
            priority: 70,
            description: 'Support client et tickets'
        });

        // Rôle VIP
        this.roles.set('vip', {
            name: 'VIP',
            color: '#f39c12',
            permissions: [
                'obfuscation.vip',
                'economy.bonus',
                'ai.priority',
                'tickets.priority',
                'notifications.personal'
            ],
            priority: 60,
            description: 'Utilisateur VIP avec privilèges'
        });

        // Rôle Premium
        this.roles.set('premium', {
            name: 'Premium',
            color: '#e74c3c',
            permissions: [
                'obfuscation.premium',
                'economy.bonus',
                'ai.use',
                'tickets.create'
            ],
            priority: 50,
            description: 'Utilisateur premium'
        });

        // Rôle Basic
        this.roles.set('basic', {
            name: 'Basic',
            color: '#95a5a6',
            permissions: [
                'obfuscation.basic',
                'economy.use',
                'ai.limited',
                'tickets.create'
            ],
            priority: 40,
            description: 'Utilisateur de base'
        });

        // Rôle Développeur
        this.roles.set('developer', {
            name: 'Développeur',
            color: '#00ff88',
            permissions: [
                'obfuscation.unlimited',
                'system.debug',
                'ai.configure',
                'webhooks.create',
                'economy.view'
            ],
            priority: 85,
            description: 'Développeur avec accès technique'
        });

        // Rôle Bêta Testeur
        this.roles.set('beta', {
            name: 'Bêta Testeur',
            color: '#1abc9c',
            permissions: [
                'obfuscation.beta',
                'features.beta',
                'ai.beta',
                'feedback.submit'
            ],
            priority: 55,
            description: 'Testeur des nouvelles fonctionnalités'
        });

        // Rôle Partenaire
        this.roles.set('partner', {
            name: 'Partenaire',
            color: '#8e44ad',
            permissions: [
                'obfuscation.partner',
                'economy.partner',
                'notifications.partner',
                'branding.custom'
            ],
            priority: 65,
            description: 'Partenaire officiel FSProtect'
        });
    }

    initializeCommandPermissions() {
        // Commandes d'obfuscation
        this.commandPermissions.set('obfusquer', ['obfuscation.basic']);
        this.commandPermissions.set('obfuscate', ['obfuscation.basic']);

        // Commandes d'administration
        this.commandPermissions.set('admin', ['user.manage']);
        this.commandPermissions.set('maintenance', ['system.maintenance']);
        this.commandPermissions.set('backup', ['system.backup']);

        // Commandes de modération
        this.commandPermissions.set('bannir', ['user.ban']);
        this.commandPermissions.set('ban', ['user.ban']);
        this.commandPermissions.set('expulser', ['user.kick']);
        this.commandPermissions.set('kick', ['user.kick']);
        this.commandPermissions.set('mute', ['user.mute']);
        this.commandPermissions.set('avertir', ['user.warn']);
        this.commandPermissions.set('warn', ['user.warn']);

        // Commandes économie
        this.commandPermissions.set('solde', ['economy.use']);
        this.commandPermissions.set('balance', ['economy.use']);
        this.commandPermissions.set('boutique', ['economy.use']);
        this.commandPermissions.set('shop', ['economy.use']);

        // Commandes IA
        this.commandPermissions.set('demander', ['ai.use']);
        this.commandPermissions.set('ask', ['ai.use']);

        // Commandes tickets
        this.commandPermissions.set('ticket', ['tickets.create']);

        // Commandes système
        this.commandPermissions.set('stats', []); // Accessible à tous
        this.commandPermissions.set('aide', []); // Accessible à tous
        this.commandPermissions.set('help', []); // Accessible à tous
        this.commandPermissions.set('prix', []); // Accessible à tous
        this.commandPermissions.set('pricing', []); // Accessible à tous
    }

    // === GESTION DES RÔLES ===

    addRole(roleId, roleData) {
        this.roles.set(roleId, {
            name: roleData.name,
            color: roleData.color || '#ffffff',
            permissions: roleData.permissions || [],
            priority: roleData.priority || 0,
            description: roleData.description || '',
            temporary: roleData.temporary || false,
            expiresAt: roleData.expiresAt || null
        });
        this.saveConfiguration();
    }

    removeRole(roleId) {
        // Retirer le rôle de tous les utilisateurs
        for (const [userId, userRoles] of this.userRoles) {
            const index = userRoles.indexOf(roleId);
            if (index > -1) {
                userRoles.splice(index, 1);
                this.userRoles.set(userId, userRoles);
            }
        }

        const removed = this.roles.delete(roleId);
        if (removed) {
            this.saveConfiguration();
        }
        return removed;
    }

    getRole(roleId) {
        return this.roles.get(roleId);
    }

    getAllRoles() {
        return Array.from(this.roles.entries()).map(([id, role]) => ({
            id,
            ...role
        }));
    }

    // === GESTION DES UTILISATEURS ===

    assignRole(userId, roleId, expiresAt = null) {
        const role = this.roles.get(roleId);
        if (!role) {
            throw new Error(`Rôle ${roleId} non trouvé`);
        }

        const userRoles = this.userRoles.get(userId) || [];
        
        if (!userRoles.includes(roleId)) {
            userRoles.push(roleId);
            this.userRoles.set(userId, userRoles);

            // Gérer l'expiration temporaire
            if (expiresAt) {
                setTimeout(() => {
                    this.removeRole(userId, roleId);
                }, expiresAt - Date.now());
            }

            this.saveConfiguration();
            return true;
        }
        return false;
    }

    removeUserRole(userId, roleId) {
        const userRoles = this.userRoles.get(userId);
        if (!userRoles) return false;

        const index = userRoles.indexOf(roleId);
        if (index > -1) {
            userRoles.splice(index, 1);
            this.userRoles.set(userId, userRoles);
            this.saveConfiguration();
            return true;
        }
        return false;
    }

    getUserRoles(userId) {
        const roleIds = this.userRoles.get(userId) || ['basic']; // Rôle basic par défaut
        return roleIds.map(id => ({
            id,
            ...this.roles.get(id)
        })).filter(role => role.name); // Filtrer les rôles inexistants
    }

    getHighestRole(userId) {
        const userRoles = this.getUserRoles(userId);
        return userRoles.reduce((highest, role) => 
            role.priority > (highest?.priority || 0) ? role : highest
        , null);
    }

    getUserPermissions(userId) {
        const userRoles = this.getUserRoles(userId);
        const permissions = new Set();

        for (const role of userRoles) {
            if (role.permissions) {
                role.permissions.forEach(perm => permissions.add(perm));
            }
        }

        return Array.from(permissions);
    }

    // === VÉRIFICATION DES PERMISSIONS ===

    hasPermission(userId, permission) {
        const userPermissions = this.getUserPermissions(userId);
        
        // Super admin a toutes les permissions
        if (userPermissions.includes('system.manage')) {
            return true;
        }

        // Vérifier la permission spécifique
        if (userPermissions.includes(permission)) {
            return true;
        }

        // Vérifier les permissions avec wildcard
        const permissionParts = permission.split('.');
        for (let i = permissionParts.length - 1; i > 0; i--) {
            const wildcardPerm = permissionParts.slice(0, i).join('.') + '.all';
            if (userPermissions.includes(wildcardPerm)) {
                return true;
            }
        }

        return false;
    }

    canExecuteCommand(userId, commandName) {
        const requiredPermissions = this.commandPermissions.get(commandName);
        
        // Si aucune permission requise, accessible à tous
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        // Vérifier si l'utilisateur a au moins une des permissions requises
        for (const permission of requiredPermissions) {
            if (this.hasPermission(userId, permission)) {
                return true;
            }
        }

        return false;
    }

    // === GESTION DES PERMISSIONS DISCORD ===

    hasDiscordPermission(member, permission) {
        return member.permissions.has(permission);
    }

    isAdmin(member) {
        return this.hasDiscordPermission(member, PermissionFlagsBits.Administrator);
    }

    isModerator(member) {
        return this.hasDiscordPermission(member, PermissionFlagsBits.ModerateMembers) ||
               this.hasDiscordPermission(member, PermissionFlagsBits.ManageMessages) ||
               this.hasDiscordPermission(member, PermissionFlagsBits.KickMembers);
    }

    canManageChannel(member, channel) {
        return channel.permissionsFor(member).has(PermissionFlagsBits.ManageChannels);
    }

    canBan(member) {
        return this.hasDiscordPermission(member, PermissionFlagsBits.BanMembers);
    }

    canKick(member) {
        return this.hasDiscordPermission(member, PermissionFlagsBits.KickMembers);
    }

    canMute(member) {
        return this.hasDiscordPermission(member, PermissionFlagsBits.ModerateMembers);
    }

    // === PERMISSIONS COMBINÉES ===

    canExecute(userId, member, commandName) {
        // Vérifier les permissions custom du bot
        if (!this.canExecuteCommand(userId, commandName)) {
            return { allowed: false, reason: 'Permissions insuffisantes' };
        }

        // Vérifier les permissions Discord pour certaines commandes
        const discordPermissionChecks = {
            'bannir': () => this.canBan(member),
            'ban': () => this.canBan(member),
            'expulser': () => this.canKick(member),
            'kick': () => this.canKick(member),
            'mute': () => this.canMute(member),
            'admin': () => this.isAdmin(member)
        };

        const discordCheck = discordPermissionChecks[commandName];
        if (discordCheck && !discordCheck()) {
            return { allowed: false, reason: 'Permissions Discord insuffisantes' };
        }

        return { allowed: true };
    }

    // === GESTION DES QUOTAS ===

    setQuota(userId, resource, limit, period = 'daily') {
        const quotaKey = `${userId}_${resource}_${period}`;
        const quota = {
            limit,
            used: 0,
            period,
            resetAt: this.getNextResetTime(period)
        };

        this.permissions.set(quotaKey, quota);
        this.saveConfiguration();
    }

    checkQuota(userId, resource, amount = 1, period = 'daily') {
        const quotaKey = `${userId}_${resource}_${period}`;
        const quota = this.permissions.get(quotaKey);

        if (!quota) {
            return { allowed: true, remaining: Infinity };
        }

        // Réinitialiser si la période est écoulée
        if (Date.now() > quota.resetAt) {
            quota.used = 0;
            quota.resetAt = this.getNextResetTime(period);
        }

        const newUsed = quota.used + amount;
        if (newUsed > quota.limit) {
            return { 
                allowed: false, 
                remaining: Math.max(0, quota.limit - quota.used),
                resetAt: quota.resetAt
            };
        }

        quota.used = newUsed;
        this.permissions.set(quotaKey, quota);
        
        return { 
            allowed: true, 
            remaining: quota.limit - newUsed,
            resetAt: quota.resetAt
        };
    }

    getNextResetTime(period) {
        const now = new Date();
        
        switch (period) {
            case 'hourly':
                return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1).getTime();
            case 'daily':
                return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
            case 'weekly':
                const daysUntilMonday = (7 - now.getDay() + 1) % 7;
                return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday).getTime();
            case 'monthly':
                return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
            default:
                return Date.now() + 24 * 60 * 60 * 1000; // 24h par défaut
        }
    }

    // === UTILITAIRES ===

    getUserInfo(userId) {
        const roles = this.getUserRoles(userId);
        const permissions = this.getUserPermissions(userId);
        const highestRole = this.getHighestRole(userId);

        return {
            userId,
            roles: roles.map(r => ({ id: r.id, name: r.name, color: r.color })),
            permissions,
            highestRole: highestRole ? { id: highestRole.id, name: highestRole.name } : null,
            quotas: this.getUserQuotas(userId)
        };
    }

    getUserQuotas(userId) {
        const quotas = {};
        
        for (const [key, quota] of this.permissions) {
            if (key.startsWith(userId + '_')) {
                const parts = key.split('_');
                const resource = parts[1];
                const period = parts[2];
                
                quotas[`${resource}_${period}`] = {
                    limit: quota.limit,
                    used: quota.used,
                    remaining: quota.limit - quota.used,
                    resetAt: quota.resetAt
                };
            }
        }

        return quotas;
    }

    getSystemStats() {
        const roleStats = {};
        const permissionStats = {};

        // Compter les utilisateurs par rôle
        for (const [userId, userRoles] of this.userRoles) {
            for (const roleId of userRoles) {
                roleStats[roleId] = (roleStats[roleId] || 0) + 1;
            }
        }

        // Compter les permissions uniques
        for (const role of this.roles.values()) {
            for (const permission of role.permissions) {
                permissionStats[permission] = (permissionStats[permission] || 0) + 1;
            }
        }

        return {
            totalUsers: this.userRoles.size,
            totalRoles: this.roles.size,
            roleDistribution: roleStats,
            permissionUsage: permissionStats,
            totalQuotas: this.permissions.size
        };
    }

    // === IMPORT/EXPORT ===

    exportConfiguration() {
        return {
            roles: Object.fromEntries(this.roles),
            userRoles: Object.fromEntries(this.userRoles),
            permissions: Object.fromEntries(this.permissions),
            commandPermissions: Object.fromEntries(this.commandPermissions),
            exportedAt: new Date().toISOString()
        };
    }

    importConfiguration(config) {
        if (config.roles) {
            this.roles = new Map(Object.entries(config.roles));
        }
        if (config.userRoles) {
            this.userRoles = new Map(Object.entries(config.userRoles));
        }
        if (config.permissions) {
            this.permissions = new Map(Object.entries(config.permissions));
        }
        if (config.commandPermissions) {
            this.commandPermissions = new Map(Object.entries(config.commandPermissions));
        }
        
        this.saveConfiguration();
    }
}

module.exports = PermissionSystem;
