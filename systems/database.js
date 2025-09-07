const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

class Database {
    constructor() {
        this.users = new Map();
        this.blacklist = new Set();
        this.settings = new Map();
        this.stats = new Map();
        this.auditLog = [];
        this.backups = [];
        
        this.dataPath = './data/';
        this.usersFile = path.join(this.dataPath, 'users.json');
        this.blacklistFile = path.join(this.dataPath, 'blacklist.json');
        this.settingsFile = path.join(this.dataPath, 'settings.json');
        this.statsFile = path.join(this.dataPath, 'stats.json');
        this.auditFile = path.join(this.dataPath, 'audit.log');
        
        this.isMaintenanceMode = false;
        this.loadAllData();
    }

    async initialize() {
        // Créer le dossier data s'il n'existe pas
        if (!fs.existsSync(this.dataPath)) {
            fs.mkdirSync(this.dataPath, { recursive: true });
        }

        // Charger les paramètres par défaut
        this.initializeDefaultSettings();
        
        // Planifier les sauvegardes automatiques
        this.scheduleAutoBackup();
        
        console.log('✅ Database système initialisé');
    }

    // ===============================
    // GESTION DES UTILISATEURS
    // ===============================

    addUser(userId, accessLevel = 'basic', expiresAt = null, metadata = {}) {
        const user = {
            id: userId,
            accessLevel: accessLevel,
            addedAt: new Date(),
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            usageCount: 0,
            totalFilesProcessed: 0,
            totalBytesProcessed: 0,
            lastUsed: null,
            lastIp: null,
            permissions: this.getDefaultPermissions(accessLevel),
            metadata: metadata,
            isActive: true,
            warningCount: 0,
            suspendedUntil: null
        };

        this.users.set(userId, user);
        this.saveUsers();
        this.logAudit('USER_ADDED', userId, { accessLevel, expiresAt });
        
        return user;
    }

    hasAccess(userId) {
        const user = this.users.get(userId);
        if (!user || !user.isActive) return false;

        // Vérifier la suspension
        if (user.suspendedUntil && new Date() < user.suspendedUntil) {
            return false;
        }

        // Vérifier l'expiration
        if (user.expiresAt && new Date() > user.expiresAt) {
            return false;
        }

        return true;
    }

    getAccessLevel(userId) {
        const user = this.users.get(userId);
        return user ? user.accessLevel : null;
    }

    hasPermission(userId, permission) {
        const user = this.users.get(userId);
        if (!user || !this.hasAccess(userId)) return false;
        
        return user.permissions.includes(permission) || user.permissions.includes('*');
    }

    incrementUsage(userId, fileSize = 0, filesCount = 1) {
        const user = this.users.get(userId);
        if (user) {
            user.usageCount++;
            user.totalFilesProcessed += filesCount;
            user.totalBytesProcessed += fileSize;
            user.lastUsed = new Date();
            this.saveUsers();
            this.updateStats('totalUsages', 1);
            this.updateStats('totalBytesProcessed', fileSize);
        }
    }

    removeUser(userId) {
        const deleted = this.users.delete(userId);
        if (deleted) {
            this.saveUsers();
            this.logAudit('USER_REMOVED', userId);
        }
        return deleted;
    }

    suspendUser(userId, duration = '24h', reason = 'Violation des règles') {
        const user = this.users.get(userId);
        if (!user) return false;

        const suspendUntil = new Date();
        const durationMs = this.parseDuration(duration);
        suspendUntil.setTime(suspendUntil.getTime() + durationMs);

        user.suspendedUntil = suspendUntil;
        user.warningCount++;
        
        this.saveUsers();
        this.logAudit('USER_SUSPENDED', userId, { duration, reason, until: suspendUntil });
        
        return true;
    }

    unsuspendUser(userId) {
        const user = this.users.get(userId);
        if (!user) return false;

        user.suspendedUntil = null;
        this.saveUsers();
        this.logAudit('USER_UNSUSPENDED', userId);
        
        return true;
    }

    getAllUsers() {
        return Array.from(this.users.values());
    }

    getUserStats(userId) {
        const user = this.users.get(userId);
        if (!user) return null;

        return {
            id: user.id,
            accessLevel: user.accessLevel,
            usageCount: user.usageCount,
            totalFilesProcessed: user.totalFilesProcessed,
            totalBytesProcessed: user.totalBytesProcessed,
            memberSince: user.addedAt,
            lastUsed: user.lastUsed,
            isActive: user.isActive,
            warningCount: user.warningCount,
            suspendedUntil: user.suspendedUntil
        };
    }

    // ===============================
    // GESTION DE LA BLACKLIST
    // ===============================

    addToBlacklist(userId, reason = 'Comportement inapproprié', addedBy = 'SYSTEM') {
        this.blacklist.add(userId);
        this.saveBlacklist();
        this.logAudit('BLACKLIST_ADD', userId, { reason, addedBy });
        
        // Supprimer l'utilisateur s'il existe
        if (this.users.has(userId)) {
            this.removeUser(userId);
        }
        
        return true;
    }

    removeFromBlacklist(userId, removedBy = 'SYSTEM') {
        const removed = this.blacklist.delete(userId);
        if (removed) {
            this.saveBlacklist();
            this.logAudit('BLACKLIST_REMOVE', userId, { removedBy });
        }
        return removed;
    }

    isBlacklisted(userId) {
        return this.blacklist.has(userId);
    }

    getBlacklist() {
        return Array.from(this.blacklist);
    }

    // ===============================
    // GESTION DES PARAMÈTRES
    // ===============================

    setSetting(key, value, updatedBy = 'SYSTEM') {
        this.settings.set(key, {
            value: value,
            updatedAt: new Date(),
            updatedBy: updatedBy
        });
        this.saveSettings();
        this.logAudit('SETTING_UPDATE', key, { value, updatedBy });
    }

    getSetting(key, defaultValue = null) {
        const setting = this.settings.get(key);
        return setting ? setting.value : defaultValue;
    }

    getAllSettings() {
        const result = {};
        for (const [key, setting] of this.settings) {
            result[key] = setting;
        }
        return result;
    }

    // ===============================
    // GESTION DES STATISTIQUES
    // ===============================

    updateStats(key, increment = 1) {
        const current = this.stats.get(key) || 0;
        this.stats.set(key, current + increment);
        this.saveStats();
    }

    getStats() {
        const result = {};
        for (const [key, value] of this.stats) {
            result[key] = value;
        }
        
        // Ajouter des statistiques calculées
        result.totalUsers = this.users.size;
        result.activeUsers = Array.from(this.users.values()).filter(u => u.isActive).length;
        result.blacklistedUsers = this.blacklist.size;
        result.suspendedUsers = Array.from(this.users.values()).filter(u => u.suspendedUntil && new Date() < u.suspendedUntil).length;
        
        return result;
    }

    resetStats() {
        this.stats.clear();
        this.saveStats();
        this.logAudit('STATS_RESET', 'SYSTEM');
    }

    // ===============================
    // MAINTENANCE ET SAUVEGARDES
    // ===============================

    setMaintenanceMode(enabled, reason = '') {
        this.isMaintenanceMode = enabled;
        this.setSetting('maintenance_mode', {
            enabled: enabled,
            reason: reason,
            timestamp: new Date()
        });
        this.logAudit('MAINTENANCE_MODE', enabled ? 'ENABLED' : 'DISABLED', { reason });
    }

    isInMaintenanceMode() {
        return this.isMaintenanceMode;
    }

    createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupData = {
            timestamp: new Date(),
            users: Array.from(this.users.entries()),
            blacklist: Array.from(this.blacklist),
            settings: Array.from(this.settings.entries()),
            stats: Array.from(this.stats.entries())
        };

        const backupPath = path.join(this.dataPath, `backup_${timestamp}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        
        this.backups.push({
            filename: `backup_${timestamp}.json`,
            path: backupPath,
            timestamp: new Date(),
            size: fs.statSync(backupPath).size
        });

        // Garder seulement les 10 dernières sauvegardes
        if (this.backups.length > 10) {
            const oldBackup = this.backups.shift();
            if (fs.existsSync(oldBackup.path)) {
                fs.unlinkSync(oldBackup.path);
            }
        }

        this.logAudit('BACKUP_CREATED', backupPath);
        return backupPath;
    }

    restoreBackup(backupPath) {
        if (!fs.existsSync(backupPath)) {
            throw new Error('Fichier de sauvegarde introuvable');
        }

        const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        
        this.users = new Map(backupData.users);
        this.blacklist = new Set(backupData.blacklist);
        this.settings = new Map(backupData.settings);
        this.stats = new Map(backupData.stats);

        this.saveAllData();
        this.logAudit('BACKUP_RESTORED', backupPath);
    }

    scheduleAutoBackup() {
        setInterval(() => {
            this.createBackup();
        }, 24 * 60 * 60 * 1000); // Sauvegarde quotidienne
    }

    // ===============================
    // AUDIT ET LOGGING
    // ===============================

    logAudit(action, target, metadata = {}) {
        const entry = {
            timestamp: new Date(),
            action: action,
            target: target,
            metadata: metadata,
            id: crypto.randomBytes(8).toString('hex')
        };

        this.auditLog.push(entry);
        
        // Garder seulement les 1000 dernières entrées
        if (this.auditLog.length > 1000) {
            this.auditLog = this.auditLog.slice(-1000);
        }

        this.saveAuditLog();
    }

    getAuditLog(limit = 100, filter = null) {
        let logs = this.auditLog.slice(-limit);
        
        if (filter) {
            logs = logs.filter(entry => 
                entry.action.includes(filter) || 
                entry.target.includes(filter)
            );
        }
        
        return logs.reverse();
    }

    // ===============================
    // UTILITAIRES
    // ===============================

    getDefaultPermissions(accessLevel) {
        const permissions = {
            'basic': ['obfuscate:basic', 'ticket:create'],
            'premium': ['obfuscate:basic', 'obfuscate:premium', 'ticket:create', 'ticket:priority'],
            'vip': ['obfuscate:*', 'ticket:*', 'stats:view'],
            'admin': ['*']
        };
        
        return permissions[accessLevel] || permissions['basic'];
    }

    parseDuration(duration) {
        const regex = /^(\d+)([smhd])$/;
        const match = duration.match(regex);
        
        if (!match) return 24 * 60 * 60 * 1000; // 24h par défaut
        
        const value = parseInt(match[1]);
        const unit = match[2];
        
        const multipliers = {
            's': 1000,
            'm': 60 * 1000,
            'h': 60 * 60 * 1000,
            'd': 24 * 60 * 60 * 1000
        };
        
        return value * (multipliers[unit] || multipliers['h']);
    }

    initializeDefaultSettings() {
        const defaults = {
            'max_file_size': 100 * 1024 * 1024, // 100MB
            'rate_limit_per_user': 5,
            'rate_limit_window': 5 * 60 * 1000, // 5 minutes
            'default_preset': 'fsprotect_ultra',
            'auto_backup_enabled': true,
            'maintenance_mode': { enabled: false, reason: '', timestamp: null },
            'antispam_enabled': true,
            'antilink_enabled': true,
            'max_messages_per_minute': 10,
            'auto_moderation_enabled': true
        };

        for (const [key, value] of Object.entries(defaults)) {
            if (!this.settings.has(key)) {
                this.setSetting(key, value, 'SYSTEM_INIT');
            }
        }
    }

    // ===============================
    // SAUVEGARDE ET CHARGEMENT
    // ===============================

    saveUsers() {
        try {
            const data = {
                users: Array.from(this.users.entries()).map(([id, user]) => [
                    id,
                    {
                        ...user,
                        addedAt: user.addedAt.toISOString(),
                        expiresAt: user.expiresAt ? user.expiresAt.toISOString() : null,
                        lastUsed: user.lastUsed ? user.lastUsed.toISOString() : null,
                        suspendedUntil: user.suspendedUntil ? user.suspendedUntil.toISOString() : null
                    }
                ])
            };
            fs.writeFileSync(this.usersFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Erreur sauvegarde utilisateurs:', error);
        }
    }

    loadUsers() {
        try {
            if (fs.existsSync(this.usersFile)) {
                const data = JSON.parse(fs.readFileSync(this.usersFile, 'utf8'));
                this.users = new Map(data.users?.map(([id, user]) => [
                    id,
                    {
                        ...user,
                        addedAt: new Date(user.addedAt),
                        expiresAt: user.expiresAt ? new Date(user.expiresAt) : null,
                        lastUsed: user.lastUsed ? new Date(user.lastUsed) : null,
                        suspendedUntil: user.suspendedUntil ? new Date(user.suspendedUntil) : null
                    }
                ]) || []);
            }
        } catch (error) {
            console.error('Erreur chargement utilisateurs:', error);
        }
    }

    saveBlacklist() {
        try {
            const data = { blacklist: Array.from(this.blacklist) };
            fs.writeFileSync(this.blacklistFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Erreur sauvegarde blacklist:', error);
        }
    }

    loadBlacklist() {
        try {
            if (fs.existsSync(this.blacklistFile)) {
                const data = JSON.parse(fs.readFileSync(this.blacklistFile, 'utf8'));
                this.blacklist = new Set(data.blacklist || []);
            }
        } catch (error) {
            console.error('Erreur chargement blacklist:', error);
        }
    }

    saveSettings() {
        try {
            const data = {
                settings: Array.from(this.settings.entries()).map(([key, setting]) => [
                    key,
                    {
                        ...setting,
                        updatedAt: setting.updatedAt.toISOString()
                    }
                ])
            };
            fs.writeFileSync(this.settingsFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Erreur sauvegarde paramètres:', error);
        }
    }

    loadSettings() {
        try {
            if (fs.existsSync(this.settingsFile)) {
                const data = JSON.parse(fs.readFileSync(this.settingsFile, 'utf8'));
                this.settings = new Map(data.settings?.map(([key, setting]) => [
                    key,
                    {
                        ...setting,
                        updatedAt: new Date(setting.updatedAt)
                    }
                ]) || []);
            }
        } catch (error) {
            console.error('Erreur chargement paramètres:', error);
        }
    }

    saveStats() {
        try {
            const data = { stats: Array.from(this.stats.entries()) };
            fs.writeFileSync(this.statsFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Erreur sauvegarde statistiques:', error);
        }
    }

    loadStats() {
        try {
            if (fs.existsSync(this.statsFile)) {
                const data = JSON.parse(fs.readFileSync(this.statsFile, 'utf8'));
                this.stats = new Map(data.stats || []);
            }
        } catch (error) {
            console.error('Erreur chargement statistiques:', error);
        }
    }

    saveAuditLog() {
        try {
            const data = { auditLog: this.auditLog };
            fs.writeFileSync(this.auditFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Erreur sauvegarde audit log:', error);
        }
    }

    loadAuditLog() {
        try {
            if (fs.existsSync(this.auditFile)) {
                const data = JSON.parse(fs.readFileSync(this.auditFile, 'utf8'));
                this.auditLog = data.auditLog || [];
            }
        } catch (error) {
            console.error('Erreur chargement audit log:', error);
        }
    }

    saveAllData() {
        this.saveUsers();
        this.saveBlacklist();
        this.saveSettings();
        this.saveStats();
        this.saveAuditLog();
    }

    loadAllData() {
        this.loadUsers();
        this.loadBlacklist();
        this.loadSettings();
        this.loadStats();
        this.loadAuditLog();
    }
}

module.exports = Database;