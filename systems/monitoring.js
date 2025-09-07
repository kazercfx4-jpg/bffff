const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

class MonitoringSystem {
    constructor(client, languageManager) {
        this.client = client;
        this.lang = languageManager;
        this.metrics = new Map();
        this.alerts = new Map();
        this.thresholds = {
            memoryUsage: 512 * 1024 * 1024, // 512MB
            cpuUsage: 80, // 80%
            responseTime: 5000, // 5 secondes
            errorRate: 0.05, // 5%
            diskUsage: 0.9 // 90%
        };
        this.startTime = Date.now();
        this.initializeMetrics();
        this.startMonitoring();
    }

    initializeMetrics() {
        this.metrics.set('commands', {
            total: 0,
            success: 0,
            errors: 0,
            responseTime: []
        });

        this.metrics.set('obfuscation', {
            total: 0,
            success: 0,
            errors: 0,
            filesProcessed: 0,
            totalSize: 0
        });

        this.metrics.set('users', {
            active: new Set(),
            daily: new Set(),
            total: 0
        });

        this.metrics.set('system', {
            memory: [],
            cpu: [],
            uptime: 0,
            errors: []
        });
    }

    startMonitoring() {
        // Monitoring toutes les 30 secondes
        setInterval(() => {
            this.collectSystemMetrics();
            this.checkThresholds();
        }, 30000);

        // Nettoyage des métriques toutes les heures
        setInterval(() => {
            this.cleanupMetrics();
        }, 3600000);

        // Rapport quotidien
        setInterval(() => {
            this.generateDailyReport();
        }, 24 * 60 * 60 * 1000);
    }

    collectSystemMetrics() {
        const metrics = this.metrics.get('system');
        
        // Mémoire
        const memUsage = process.memoryUsage();
        metrics.memory.push({
            timestamp: Date.now(),
            heap: memUsage.heapUsed,
            external: memUsage.external,
            rss: memUsage.rss
        });

        // CPU
        const cpuUsage = process.cpuUsage();
        metrics.cpu.push({
            timestamp: Date.now(),
            user: cpuUsage.user,
            system: cpuUsage.system
        });

        // Uptime
        metrics.uptime = Date.now() - this.startTime;

        // Garder seulement les 720 dernières mesures (6 heures)
        if (metrics.memory.length > 720) {
            metrics.memory = metrics.memory.slice(-720);
        }
        if (metrics.cpu.length > 720) {
            metrics.cpu = metrics.cpu.slice(-720);
        }
    }

    checkThresholds() {
        const memUsage = process.memoryUsage().heapUsed;
        const cpuPercent = this.getCpuUsagePercent();
        
        // Alerte mémoire
        if (memUsage > this.thresholds.memoryUsage) {
            this.createAlert('high_memory', {
                current: Math.round(memUsage / 1024 / 1024),
                threshold: Math.round(this.thresholds.memoryUsage / 1024 / 1024)
            });
        }

        // Alerte CPU
        if (cpuPercent > this.thresholds.cpuUsage) {
            this.createAlert('high_cpu', {
                current: cpuPercent.toFixed(1),
                threshold: this.thresholds.cpuUsage
            });
        }

        // Alerte taux d'erreur
        const errorRate = this.getErrorRate();
        if (errorRate > this.thresholds.errorRate) {
            this.createAlert('high_error_rate', {
                current: (errorRate * 100).toFixed(1),
                threshold: (this.thresholds.errorRate * 100).toFixed(1)
            });
        }
    }

    createAlert(type, data) {
        const alertId = `${type}_${Date.now()}`;
        
        if (this.alerts.has(type) && Date.now() - this.alerts.get(type).lastSent < 300000) {
            return; // Éviter le spam d'alertes (5 minutes minimum)
        }

        const alert = {
            id: alertId,
            type,
            data,
            timestamp: Date.now(),
            lastSent: Date.now()
        };

        this.alerts.set(type, alert);
        this.sendAlert(alert);
    }

    async sendAlert(alert) {
        try {
            const alertMessages = {
                high_memory: `🚨 **Alerte Mémoire**\nUtilisation: ${alert.data.current}MB / ${alert.data.threshold}MB`,
                high_cpu: `🚨 **Alerte CPU**\nUtilisation: ${alert.data.current}% / ${alert.data.threshold}%`,
                high_error_rate: `🚨 **Alerte Erreurs**\nTaux d'erreur: ${alert.data.current}% / ${alert.data.threshold}%`,
                low_disk: `🚨 **Alerte Disque**\nEspace libre: ${alert.data.current}%`,
                service_down: `🚨 **Service Indisponible**\nService: ${alert.data.service}`
            };

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚨 Alerte Système FSProtect')
                .setDescription(alertMessages[alert.type] || 'Alerte système')
                .addFields(
                    { name: 'Timestamp', value: new Date(alert.timestamp).toLocaleString(), inline: true },
                    { name: 'Serveur', value: os.hostname(), inline: true },
                    { name: 'Type', value: alert.type, inline: true }
                )
                .setTimestamp();

            // Envoyer dans le canal d'alertes si configuré
            const alertChannelId = process.env.ALERT_CHANNEL_ID;
            if (alertChannelId) {
                const channel = await this.client.channels.fetch(alertChannelId);
                if (channel) {
                    await channel.send({ embeds: [embed] });
                }
            }

        } catch (error) {
            console.error('Erreur envoi alerte:', error);
        }
    }

    recordCommand(commandName, success, responseTime, userId) {
        const commandMetrics = this.metrics.get('commands');
        commandMetrics.total++;
        
        if (success) {
            commandMetrics.success++;
        } else {
            commandMetrics.errors++;
        }

        commandMetrics.responseTime.push({
            timestamp: Date.now(),
            time: responseTime,
            command: commandName
        });

        // Garder seulement les 1000 derniers temps de réponse
        if (commandMetrics.responseTime.length > 1000) {
            commandMetrics.responseTime = commandMetrics.responseTime.slice(-1000);
        }

        // Enregistrer l'utilisateur actif
        const userMetrics = this.metrics.get('users');
        userMetrics.active.add(userId);
        userMetrics.daily.add(userId);
    }

    recordObfuscation(success, fileSize, processingTime) {
        const obfuscationMetrics = this.metrics.get('obfuscation');
        obfuscationMetrics.total++;
        
        if (success) {
            obfuscationMetrics.success++;
            obfuscationMetrics.filesProcessed++;
            obfuscationMetrics.totalSize += fileSize;
        } else {
            obfuscationMetrics.errors++;
        }
    }

    recordError(error, context) {
        const systemMetrics = this.metrics.get('system');
        systemMetrics.errors.push({
            timestamp: Date.now(),
            error: error.message,
            stack: error.stack,
            context
        });

        // Garder seulement les 500 dernières erreurs
        if (systemMetrics.errors.length > 500) {
            systemMetrics.errors = systemMetrics.errors.slice(-500);
        }
    }

    getSystemStatus() {
        const memUsage = process.memoryUsage();
        const cpuPercent = this.getCpuUsagePercent();
        const uptime = Date.now() - this.startTime;
        
        return {
            status: this.getOverallStatus(),
            uptime: uptime,
            memory: {
                used: memUsage.heapUsed,
                total: memUsage.rss,
                percentage: (memUsage.heapUsed / memUsage.rss) * 100
            },
            cpu: {
                percentage: cpuPercent
            },
            guilds: this.client.guilds.cache.size,
            users: this.client.users.cache.size,
            ping: this.client.ws.ping
        };
    }

    getOverallStatus() {
        const memUsage = process.memoryUsage().heapUsed;
        const cpuPercent = this.getCpuUsagePercent();
        const errorRate = this.getErrorRate();

        if (memUsage > this.thresholds.memoryUsage || 
            cpuPercent > this.thresholds.cpuUsage || 
            errorRate > this.thresholds.errorRate) {
            return 'critical';
        }

        if (memUsage > this.thresholds.memoryUsage * 0.8 || 
            cpuPercent > this.thresholds.cpuUsage * 0.8 || 
            errorRate > this.thresholds.errorRate * 0.8) {
            return 'warning';
        }

        return 'healthy';
    }

    getCpuUsagePercent() {
        const cpuMetrics = this.metrics.get('system').cpu;
        if (cpuMetrics.length < 2) return 0;

        const current = cpuMetrics[cpuMetrics.length - 1];
        const previous = cpuMetrics[cpuMetrics.length - 2];
        
        const userDiff = current.user - previous.user;
        const systemDiff = current.system - previous.system;
        const totalDiff = userDiff + systemDiff;
        
        return (totalDiff / 1000000) * 100; // Convertir de microsecondes en pourcentage
    }

    getErrorRate() {
        const commandMetrics = this.metrics.get('commands');
        if (commandMetrics.total === 0) return 0;
        return commandMetrics.errors / commandMetrics.total;
    }

    getAverageResponseTime() {
        const commandMetrics = this.metrics.get('commands');
        if (commandMetrics.responseTime.length === 0) return 0;
        
        const total = commandMetrics.responseTime.reduce((sum, entry) => sum + entry.time, 0);
        return total / commandMetrics.responseTime.length;
    }

    async generateStatusEmbed() {
        const status = this.getSystemStatus();
        const commandMetrics = this.metrics.get('commands');
        const obfuscationMetrics = this.metrics.get('obfuscation');
        const userMetrics = this.metrics.get('users');

        const statusColors = {
            healthy: '#00ff00',
            warning: '#ffaa00',
            critical: '#ff0000'
        };

        const statusEmojis = {
            healthy: '🟢',
            warning: '🟡',
            critical: '🔴'
        };

        const embed = new EmbedBuilder()
            .setColor(statusColors[status.status])
            .setTitle(`${statusEmojis[status.status]} Status Système FSProtect`)
            .setDescription(`État général: **${status.status.toUpperCase()}**`)
            .addFields(
                {
                    name: '🤖 Bot',
                    value: `**Uptime:** ${this.formatUptime(status.uptime)}\n**Ping:** ${status.ping}ms\n**Serveurs:** ${status.guilds}\n**Utilisateurs:** ${status.users}`,
                    inline: true
                },
                {
                    name: '💻 Système',
                    value: `**Mémoire:** ${Math.round(status.memory.used / 1024 / 1024)}MB (${status.memory.percentage.toFixed(1)}%)\n**CPU:** ${status.cpu.percentage.toFixed(1)}%\n**Plateforme:** ${os.platform()}\n**Version Node:** ${process.version}`,
                    inline: true
                },
                {
                    name: '📊 Performance',
                    value: `**Commandes:** ${commandMetrics.total.toLocaleString()}\n**Succès:** ${commandMetrics.success.toLocaleString()}\n**Erreurs:** ${commandMetrics.errors.toLocaleString()}\n**Temps moyen:** ${this.getAverageResponseTime().toFixed(0)}ms`,
                    inline: true
                },
                {
                    name: '🔒 Obfuscation',
                    value: `**Total:** ${obfuscationMetrics.total.toLocaleString()}\n**Réussies:** ${obfuscationMetrics.success.toLocaleString()}\n**Fichiers:** ${obfuscationMetrics.filesProcessed.toLocaleString()}\n**Taille totale:** ${this.formatBytes(obfuscationMetrics.totalSize)}`,
                    inline: true
                },
                {
                    name: '👥 Utilisateurs',
                    value: `**Actifs (24h):** ${userMetrics.daily.size.toLocaleString()}\n**Actifs maintenant:** ${userMetrics.active.size.toLocaleString()}\n**Taux d'erreur:** ${(this.getErrorRate() * 100).toFixed(2)}%`,
                    inline: true
                },
                {
                    name: '🚨 Alertes',
                    value: `**Actives:** ${this.alerts.size}\n**Dernière:** ${this.getLastAlertTime()}\n**Seuils:** ${this.getThresholdStatus()}`,
                    inline: true
                }
            )
            .setFooter({ text: 'Dernière mise à jour' })
            .setTimestamp();

        return embed;
    }

    formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}j ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getLastAlertTime() {
        if (this.alerts.size === 0) return 'Aucune';
        
        let lastTime = 0;
        for (const alert of this.alerts.values()) {
            if (alert.timestamp > lastTime) {
                lastTime = alert.timestamp;
            }
        }
        
        const timeDiff = Date.now() - lastTime;
        return timeDiff < 3600000 ? `${Math.round(timeDiff / 60000)}m ago` : `${Math.round(timeDiff / 3600000)}h ago`;
    }

    getThresholdStatus() {
        const memUsage = process.memoryUsage().heapUsed;
        const memPercent = (memUsage / this.thresholds.memoryUsage) * 100;
        const cpuPercent = (this.getCpuUsagePercent() / this.thresholds.cpuUsage) * 100;
        const errorPercent = (this.getErrorRate() / this.thresholds.errorRate) * 100;

        const maxPercent = Math.max(memPercent, cpuPercent, errorPercent);
        
        if (maxPercent > 100) return '🔴 Dépassé';
        if (maxPercent > 80) return '🟡 Proche';
        return '🟢 Normal';
    }

    cleanupMetrics() {
        const userMetrics = this.metrics.get('users');
        
        // Réinitialiser les utilisateurs actifs
        userMetrics.active.clear();
        
        // Nettoyer les anciennes erreurs (plus de 24h)
        const systemMetrics = this.metrics.get('system');
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        systemMetrics.errors = systemMetrics.errors.filter(error => error.timestamp > dayAgo);
        
        // Nettoyer les anciens temps de réponse (plus de 1h)
        const hourAgo = Date.now() - 60 * 60 * 1000;
        const commandMetrics = this.metrics.get('commands');
        commandMetrics.responseTime = commandMetrics.responseTime.filter(rt => rt.timestamp > hourAgo);
    }

    async generateDailyReport() {
        try {
            const userMetrics = this.metrics.get('users');
            const commandMetrics = this.metrics.get('commands');
            const obfuscationMetrics = this.metrics.get('obfuscation');
            
            const report = {
                date: new Date().toDateString(),
                users: {
                    daily: userMetrics.daily.size,
                    total: this.client.users.cache.size
                },
                commands: {
                    total: commandMetrics.total,
                    success: commandMetrics.success,
                    errors: commandMetrics.errors
                },
                obfuscation: {
                    total: obfuscationMetrics.total,
                    success: obfuscationMetrics.success,
                    files: obfuscationMetrics.filesProcessed,
                    size: obfuscationMetrics.totalSize
                },
                performance: {
                    avgResponseTime: this.getAverageResponseTime(),
                    errorRate: this.getErrorRate(),
                    uptime: Date.now() - this.startTime
                }
            };

            // Sauvegarder le rapport
            const reportPath = path.join(__dirname, '..', 'data', 'reports', `report_${Date.now()}.json`);
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

            // Réinitialiser les métriques quotidiennes
            userMetrics.daily.clear();
            
            console.log('📊 Rapport quotidien généré:', reportPath);

        } catch (error) {
            console.error('Erreur génération rapport quotidien:', error);
        }
    }

    getHealthCheckEndpoint() {
        return {
            status: this.getOverallStatus(),
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime,
            memory: process.memoryUsage(),
            cpu: this.getCpuUsagePercent(),
            guilds: this.client.guilds.cache.size,
            users: this.client.users.cache.size,
            ping: this.client.ws.ping,
            version: process.version,
            platform: os.platform()
        };
    }

    async generateDetailedReport(period = '24h') {
        const hours = period === '24h' ? 24 : period === '7d' ? 168 : 1;
        const startTime = Date.now() - (hours * 60 * 60 * 1000);
        
        const systemMetrics = this.metrics.get('system');
        const commandMetrics = this.metrics.get('commands');
        
        // Filtrer les métriques par période
        const filteredMemory = systemMetrics.memory.filter(m => m.timestamp > startTime);
        const filteredCpu = systemMetrics.cpu.filter(c => c.timestamp > startTime);
        const filteredErrors = systemMetrics.errors.filter(e => e.timestamp > startTime);
        const filteredCommands = commandMetrics.responseTime.filter(rt => rt.timestamp > startTime);

        return {
            period,
            startTime: new Date(startTime).toISOString(),
            endTime: new Date().toISOString(),
            memory: {
                avg: filteredMemory.reduce((sum, m) => sum + m.heap, 0) / filteredMemory.length || 0,
                max: Math.max(...filteredMemory.map(m => m.heap)) || 0,
                min: Math.min(...filteredMemory.map(m => m.heap)) || 0
            },
            cpu: {
                avg: filteredCpu.reduce((sum, c) => sum + (c.user + c.system), 0) / filteredCpu.length || 0,
                samples: filteredCpu.length
            },
            errors: {
                total: filteredErrors.length,
                types: this.groupErrorsByType(filteredErrors)
            },
            commands: {
                total: filteredCommands.length,
                avgResponseTime: filteredCommands.reduce((sum, rt) => sum + rt.time, 0) / filteredCommands.length || 0,
                slowest: Math.max(...filteredCommands.map(rt => rt.time)) || 0,
                fastest: Math.min(...filteredCommands.map(rt => rt.time)) || 0
            }
        };
    }

    groupErrorsByType(errors) {
        const types = {};
        for (const error of errors) {
            const type = error.context || 'unknown';
            types[type] = (types[type] || 0) + 1;
        }
        return types;
    }
}

module.exports = MonitoringSystem;
