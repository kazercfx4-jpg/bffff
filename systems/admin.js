const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

class AdminPanel {
    constructor() {
        this.maintenanceMode = false;
        this.maintenanceReason = '';
        this.blacklistedUsers = new Set();
        this.adminUsers = new Set();
        this.systemStats = {
            uptime: Date.now(),
            commandsExecuted: 0,
            errorsEncountered: 0,
            filesObfuscated: 0,
            bytesProcessed: 0,
            ticketsCreated: 0,
            usersAdded: 0,
            usersRemoved: 0
        };
        
        this.dataPath = path.join(__dirname, '..', 'data');
        this.adminFile = path.join(this.dataPath, 'admin.json');
        this.loadAdminData();
    }

    async initialize() {
        // Créer le dossier data s'il n'existe pas
        if (!fs.existsSync(this.dataPath)) {
            fs.mkdirSync(this.dataPath, { recursive: true });
        }

        // Charger les données administrateur
        this.loadAdminData();
        
        // Planifier les tâches de maintenance
        this.scheduleMaintenance();
        
        console.log('✅ Panel d\'administration initialisé');
    }

    // ===============================
    // GESTION DU MODE MAINTENANCE
    // ===============================

    setMaintenanceMode(enabled, reason = '', adminId = null) {
        this.maintenanceMode = enabled;
        this.maintenanceReason = reason;
        
        if (enabled) {
            console.log(`🔧 Mode maintenance activé: ${reason}`);
        } else {
            console.log('✅ Mode maintenance désactivé');
        }
        
        this.logAdminAction(adminId || 'SYSTEM', 'MAINTENANCE_MODE_TOGGLE', {
            enabled: enabled,
            reason: reason
        });
        
        this.saveAdminData();
        return true;
    }

    isMaintenanceMode() {
        return this.maintenanceMode;
    }

    getMaintenanceInfo() {
        return {
            enabled: this.maintenanceMode,
            reason: this.maintenanceReason,
            startTime: this.maintenanceStartTime || null
        };
    }

    // ===============================
    // GESTION DE LA LISTE NOIRE
    // ===============================

    addToBlacklist(userId, adminId = null, reason = 'Non spécifié') {
        this.blacklistedUsers.add(userId);
        
        this.logAdminAction(adminId || 'SYSTEM', 'BLACKLIST_ADD', {
            targetUserId: userId,
            reason: reason
        });
        
        this.saveAdminData();
        return true;
    }

    removeFromBlacklist(userId, adminId = null) {
        const removed = this.blacklistedUsers.delete(userId);
        
        if (removed) {
            this.logAdminAction(adminId || 'SYSTEM', 'BLACKLIST_REMOVE', {
                targetUserId: userId
            });
            
            this.saveAdminData();
        }
        
        return removed;
    }

    isBlacklisted(userId) {
        return this.blacklistedUsers.has(userId);
    }

    getBlacklist() {
        return Array.from(this.blacklistedUsers).map(userId => ({
            userId: userId,
            addedAt: new Date().toISOString() // Simulé pour l'exemple
        }));
    }

    // ===============================
    // GESTION DES ADMINISTRATEURS
    // ===============================

    addAdmin(userId, promotedBy = null) {
        this.adminUsers.add(userId);
        
        this.logAdminAction(promotedBy || 'SYSTEM', 'ADMIN_ADD', {
            targetUserId: userId
        });
        
        this.saveAdminData();
        return true;
    }

    removeAdmin(userId, demotedBy = null) {
        const removed = this.adminUsers.delete(userId);
        
        if (removed) {
            this.logAdminAction(demotedBy || 'SYSTEM', 'ADMIN_REMOVE', {
                targetUserId: userId
            });
            
            this.saveAdminData();
        }
        
        return removed;
    }

    isAdmin(userId) {
        return this.adminUsers.has(userId);
    }

    getAdmins() {
        return Array.from(this.adminUsers);
    }

    // ===============================
    // STATISTIQUES GLOBALES
    // ===============================

    getGlobalStats() {
        const uptime = Date.now() - this.systemStats.uptime;
        
        return {
            // Statistiques système
            uptime: uptime,
            uptimeFormatted: this.formatUptime(uptime),
            
            // Statistiques d'utilisation
            commandsExecuted: this.systemStats.commandsExecuted,
            errorsEncountered: this.systemStats.errorsEncountered,
            
            // Statistiques d'obfuscation
            totalObfuscations: this.systemStats.filesObfuscated,
            todayObfuscations: this.getTodayObfuscations(),
            obfuscationErrors: this.getObfuscationErrors(),
            bytesProcessed: this.systemStats.bytesProcessed,
            
            // Statistiques de tickets
            totalTickets: this.systemStats.ticketsCreated,
            openTickets: this.getOpenTickets(),
            closedTickets: this.getClosedTickets(),
            
            // Statistiques d'utilisateurs
            totalUsers: this.systemStats.usersAdded,
            basicUsers: this.getBasicUsers(),
            premiumUsers: this.getPremiumUsers(),
            vipUsers: this.getVIPUsers(),
            adminUsers: this.adminUsers.size,
            blacklistedUsers: this.blacklistedUsers.size,
            
            // Statistiques de performance
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            
            // Informations système
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        };
    }

    incrementStat(statName, value = 1) {
        if (this.systemStats[statName] !== undefined) {
            this.systemStats[statName] += value;
        } else {
            this.systemStats[statName] = value;
        }
    }

    setStat(statName, value) {
        this.systemStats[statName] = value;
    }

    // ===============================
    // SYSTÈME DE SAUVEGARDE
    // ===============================

    createBackup() {
        const timestamp = new Date().toISOString();
        const backupId = crypto.randomBytes(8).toString('hex');
        
        const backupData = {
            id: backupId,
            timestamp: timestamp,
            version: '3.0.0',
            
            // Données admin
            maintenanceMode: this.maintenanceMode,
            maintenanceReason: this.maintenanceReason,
            blacklistedUsers: Array.from(this.blacklistedUsers),
            adminUsers: Array.from(this.adminUsers),
            
            // Statistiques
            systemStats: { ...this.systemStats },
            
            // Logs (derniers 1000)
            logs: this.getRecentLogs(1000),
            
            // Métadonnées
            metadata: {
                backupSize: 0, // Sera calculé après
                compressionRatio: 0,
                creator: 'ADMIN_PANEL',
                environment: process.env.NODE_ENV || 'production'
            }
        };
        
        // Calculer la taille
        const backupString = JSON.stringify(backupData, null, 2);
        backupData.metadata.backupSize = Buffer.byteLength(backupString, 'utf8');
        
        return backupData;
    }

    restoreBackup(backupData) {
        try {
            // Vérifier la version
            if (!backupData.version) {
                throw new Error('Format de sauvegarde non valide');
            }
            
            // Restaurer les données
            this.maintenanceMode = backupData.maintenanceMode || false;
            this.maintenanceReason = backupData.maintenanceReason || '';
            this.blacklistedUsers = new Set(backupData.blacklistedUsers || []);
            this.adminUsers = new Set(backupData.adminUsers || []);
            
            if (backupData.systemStats) {
                this.systemStats = { ...this.systemStats, ...backupData.systemStats };
            }
            
            this.saveAdminData();
            
            this.logAdminAction('SYSTEM', 'BACKUP_RESTORED', {
                backupId: backupData.id,
                timestamp: backupData.timestamp
            });
            
            console.log('✅ Sauvegarde restaurée avec succès');
            return true;
            
        } catch (error) {
            console.error('❌ Erreur lors de la restauration:', error);
            return false;
        }
    }

    // ===============================
    // SYSTÈME DE LOGS
    // ===============================

    logAdminAction(adminId, action, details = {}) {
        const logEntry = {
            id: crypto.randomBytes(8).toString('hex'),
            timestamp: new Date().toISOString(),
            adminId: adminId,
            action: action,
            details: details,
            ip: details.ip || 'unknown',
            userAgent: details.userAgent || 'bot'
        };
        
        if (!this.adminLogs) {
            this.adminLogs = [];
        }
        
        this.adminLogs.push(logEntry);
        
        // Garder seulement les 5000 derniers logs
        if (this.adminLogs.length > 5000) {
            this.adminLogs = this.adminLogs.slice(-5000);
        }
        
        console.log(`📊 [ADMIN] ${adminId} - ${action}`);
    }

    getRecentLogs(limit = 100) {
        if (!this.adminLogs) return [];
        return this.adminLogs.slice(-limit).reverse();
    }

    searchLogs(query, limit = 50) {
        if (!this.adminLogs) return [];
        
        const filtered = this.adminLogs.filter(log => 
            log.action.toLowerCase().includes(query.toLowerCase()) ||
            log.adminId.toLowerCase().includes(query.toLowerCase()) ||
            JSON.stringify(log.details).toLowerCase().includes(query.toLowerCase())
        );
        
        return filtered.slice(-limit).reverse();
    }

    // ===============================
    // SURVEILLANCE SYSTÈME
    // ===============================

    getSystemHealth() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const uptime = process.uptime();
        
        return {
            status: this.determineHealthStatus(),
            uptime: uptime,
            memory: {
                used: memUsage.heapUsed,
                total: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss,
                usagePercentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            errors: {
                total: this.systemStats.errorsEncountered,
                recent: this.getRecentErrors()
            },
            performance: {
                averageResponseTime: this.calculateAverageResponseTime(),
                requestsPerSecond: this.calculateRequestsPerSecond()
            }
        };
    }

    determineHealthStatus() {
        const memUsage = process.memoryUsage();
        const memPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        const recentErrors = this.getRecentErrors();
        
        if (memPercentage > 90 || recentErrors > 10) {
            return 'CRITICAL';
        } else if (memPercentage > 70 || recentErrors > 5) {
            return 'WARNING';
        } else {
            return 'HEALTHY';
        }
    }

    // ===============================
    // TÂCHES DE MAINTENANCE
    // ===============================

    scheduleMaintenance() {
        // Nettoyage quotidien à 3h du matin
        setInterval(() => {
            const now = new Date();
            if (now.getHours() === 3 && now.getMinutes() === 0) {
                this.performDailyMaintenance();
            }
        }, 60000); // Vérifier chaque minute
        
        // Sauvegarde automatique toutes les heures
        setInterval(() => {
            this.saveAdminData();
        }, 3600000);
        
        // Nettoyage des logs toutes les 6 heures
        setInterval(() => {
            this.cleanupOldLogs();
        }, 21600000);
    }

    performDailyMaintenance() {
        console.log('🧹 Début de la maintenance quotidienne...');
        
        // Nettoyer les logs anciens
        this.cleanupOldLogs();
        
        // Nettoyer les fichiers temporaires
        this.cleanupTempFiles();
        
        // Sauvegarder les données
        this.saveAdminData();
        
        // Créer une sauvegarde automatique
        const backup = this.createBackup();
        
        this.logAdminAction('SYSTEM', 'DAILY_MAINTENANCE', {
            logsCleanup: true,
            tempFilesCleanup: true,
            backupCreated: backup.id
        });
        
        console.log('✅ Maintenance quotidienne terminée');
    }

    cleanupOldLogs() {
        if (this.adminLogs && this.adminLogs.length > 3000) {
            const removed = this.adminLogs.length - 3000;
            this.adminLogs = this.adminLogs.slice(-3000);
            console.log(`🧹 ${removed} anciens logs supprimés`);
        }
    }

    cleanupTempFiles() {
        const tempDir = path.join(__dirname, '..', 'temp');
        if (fs.existsSync(tempDir)) {
            const files = fs.readdirSync(tempDir);
            let cleaned = 0;
            
            files.forEach(file => {
                const filePath = path.join(tempDir, file);
                const stat = fs.statSync(filePath);
                const now = new Date();
                const fileAge = now - stat.mtime;
                
                // Supprimer les fichiers de plus de 24h
                if (fileAge > 24 * 60 * 60 * 1000) {
                    fs.unlinkSync(filePath);
                    cleaned++;
                }
            });
            
            if (cleaned > 0) {
                console.log(`🧹 ${cleaned} fichiers temporaires supprimés`);
            }
        }
    }

    // ===============================
    // UTILITAIRES
    // ===============================

    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}j ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Méthodes simulées pour les statistiques
    getTodayObfuscations() { return Math.floor(Math.random() * 100); }
    getObfuscationErrors() { return Math.floor(Math.random() * 5); }
    getOpenTickets() { return Math.floor(Math.random() * 20); }
    getClosedTickets() { return Math.floor(Math.random() * 100); }
    getBasicUsers() { return Math.floor(Math.random() * 500); }
    getPremiumUsers() { return Math.floor(Math.random() * 200); }
    getVIPUsers() { return Math.floor(Math.random() * 50); }
    getRecentErrors() { return Math.floor(Math.random() * 3); }
    calculateAverageResponseTime() { return Math.floor(Math.random() * 200) + 50; }
    calculateRequestsPerSecond() { return Math.floor(Math.random() * 10) + 1; }

    // ===============================
    // SAUVEGARDE ET CHARGEMENT
    // ===============================

    saveAdminData() {
        try {
            const data = {
                maintenanceMode: this.maintenanceMode,
                maintenanceReason: this.maintenanceReason,
                blacklistedUsers: Array.from(this.blacklistedUsers),
                adminUsers: Array.from(this.adminUsers),
                systemStats: this.systemStats,
                adminLogs: this.adminLogs || [],
                lastSaved: new Date().toISOString()
            };
            
            fs.writeFileSync(this.adminFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('❌ Erreur lors de la sauvegarde admin:', error);
        }
    }

    loadAdminData() {
        try {
            if (fs.existsSync(this.adminFile)) {
                const data = JSON.parse(fs.readFileSync(this.adminFile, 'utf8'));
                
                this.maintenanceMode = data.maintenanceMode || false;
                this.maintenanceReason = data.maintenanceReason || '';
                this.blacklistedUsers = new Set(data.blacklistedUsers || []);
                this.adminUsers = new Set(data.adminUsers || []);
                this.systemStats = { ...this.systemStats, ...data.systemStats };
                this.adminLogs = data.adminLogs || [];
                
                console.log('✅ Données admin chargées');
            }
        } catch (error) {
            console.error('❌ Erreur lors du chargement admin:', error);
        }
    }
}

module.exports = AdminPanel;
