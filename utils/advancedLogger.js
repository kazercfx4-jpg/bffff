const fs = require('fs');
const path = require('path');
const util = require('util');

class AdvancedLogger {
    constructor() {
        this.logsDir = path.join(__dirname, '..', 'logs');
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.maxFiles = 30; // 30 jours de logs
        this.logLevels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3,
            TRACE: 4
        };
        
        this.currentLevel = this.logLevels.INFO;
        this.logStreams = new Map();
        this.logStats = {
            totalLogs: 0,
            errorCount: 0,
            warnCount: 0,
            infoCount: 0,
            debugCount: 0,
            traceCount: 0,
            startTime: Date.now()
        };

        this.ensureLogsDirectory();
        this.initializeLogFiles();
        this.startLogRotation();
    }

    ensureLogsDirectory() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }

        // Créer les sous-dossiers
        const subDirs = ['errors', 'system', 'commands', 'moderation', 'security', 'performance'];
        subDirs.forEach(dir => {
            const dirPath = path.join(this.logsDir, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        });
    }

    initializeLogFiles() {
        const today = new Date().toISOString().split('T')[0];
        
        // Fichiers de log principaux
        this.logFiles = {
            main: path.join(this.logsDir, `main_${today}.log`),
            error: path.join(this.logsDir, 'errors', `error_${today}.log`),
            system: path.join(this.logsDir, 'system', `system_${today}.log`),
            commands: path.join(this.logsDir, 'commands', `commands_${today}.log`),
            moderation: path.join(this.logsDir, 'moderation', `moderation_${today}.log`),
            security: path.join(this.logsDir, 'security', `security_${today}.log`),
            performance: path.join(this.logsDir, 'performance', `performance_${today}.log`)
        };

        // Créer les flux d'écriture
        for (const [category, filePath] of Object.entries(this.logFiles)) {
            this.logStreams.set(category, fs.createWriteStream(filePath, { flags: 'a' }));
        }
    }

    // === MÉTHODES DE LOGGING ===

    error(message, metadata = {}) {
        this.log('ERROR', message, metadata, ['main', 'error']);
        this.logStats.errorCount++;
    }

    warn(message, metadata = {}) {
        this.log('WARN', message, metadata, ['main']);
        this.logStats.warnCount++;
    }

    info(message, metadata = {}) {
        this.log('INFO', message, metadata, ['main']);
        this.logStats.infoCount++;
    }

    debug(message, metadata = {}) {
        if (this.currentLevel >= this.logLevels.DEBUG) {
            this.log('DEBUG', message, metadata, ['main']);
            this.logStats.debugCount++;
        }
    }

    trace(message, metadata = {}) {
        if (this.currentLevel >= this.logLevels.TRACE) {
            this.log('TRACE', message, metadata, ['main']);
            this.logStats.traceCount++;
        }
    }

    // === LOGGING SPÉCIALISÉ ===

    command(userId, guildId, commandName, args, success = true, error = null) {
        const logData = {
            timestamp: new Date().toISOString(),
            level: success ? 'INFO' : 'ERROR',
            category: 'COMMAND',
            userId,
            guildId,
            command: commandName,
            args: args.slice(0, 3), // Limiter les args pour éviter les données sensibles
            success,
            error: error?.message,
            duration: metadata?.duration || 0
        };

        this.writeToStream('commands', this.formatLogEntry(logData));
        
        if (!success) {
            this.error(`Commande échouée: ${commandName}`, { userId, guildId, error: error?.message });
        }
    }

    moderation(moderatorId, targetId, action, reason, metadata = {}) {
        const logData = {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            category: 'MODERATION',
            moderatorId,
            targetId,
            action,
            reason,
            ...metadata
        };

        this.writeToStream('moderation', this.formatLogEntry(logData));
        this.info(`Action modération: ${action}`, { moderatorId, targetId, reason });
    }

    security(event, severity, details = {}) {
        const logData = {
            timestamp: new Date().toISOString(),
            level: severity.toUpperCase(),
            category: 'SECURITY',
            event,
            severity,
            ...details
        };

        this.writeToStream('security', this.formatLogEntry(logData));
        
        if (severity === 'high' || severity === 'critical') {
            this.error(`Alerte sécurité: ${event}`, details);
        }
    }

    performance(operation, duration, metadata = {}) {
        const logData = {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            category: 'PERFORMANCE',
            operation,
            duration,
            ...metadata
        };

        this.writeToStream('performance', this.formatLogEntry(logData));
        
        // Alerter si l'opération est lente
        if (duration > 5000) { // 5 secondes
            this.warn(`Opération lente détectée: ${operation}`, { duration, ...metadata });
        }
    }

    system(event, data = {}) {
        const logData = {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            category: 'SYSTEM',
            event,
            ...data
        };

        this.writeToStream('system', this.formatLogEntry(logData));
    }

    // === MÉTHODE GÉNÉRIQUE ===

    log(level, message, metadata = {}, categories = ['main']) {
        if (this.logLevels[level] > this.currentLevel) {
            return;
        }

        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...metadata
        };

        const formattedEntry = this.formatLogEntry(logEntry);

        // Écrire dans les catégories spécifiées
        categories.forEach(category => {
            this.writeToStream(category, formattedEntry);
        });

        // Afficher dans la console en mode développement
        if (process.env.NODE_ENV === 'development') {
            this.consoleLog(level, message, metadata);
        }

        this.logStats.totalLogs++;
    }

    // === FORMATAGE ===

    formatLogEntry(entry) {
        const timestamp = entry.timestamp;
        const level = entry.level.padEnd(5);
        const message = entry.message || '';
        
        let formatted = `[${timestamp}] ${level} ${message}`;

        // Ajouter les métadonnées
        const metadata = { ...entry };
        delete metadata.timestamp;
        delete metadata.level;
        delete metadata.message;

        if (Object.keys(metadata).length > 0) {
            formatted += ` | ${JSON.stringify(metadata)}`;
        }

        return formatted + '\n';
    }

    consoleLog(level, message, metadata) {
        const colors = {
            ERROR: '\x1b[31m',   // Rouge
            WARN: '\x1b[33m',    // Jaune
            INFO: '\x1b[36m',    // Cyan
            DEBUG: '\x1b[35m',   // Magenta
            TRACE: '\x1b[37m'    // Blanc
        };
        
        const reset = '\x1b[0m';
        const color = colors[level] || '';
        
        const timestamp = new Date().toISOString();
        const metaStr = Object.keys(metadata).length > 0 ? ` | ${util.inspect(metadata, { colors: true, depth: 2 })}` : '';
        
        console.log(`${color}[${timestamp}] ${level}${reset} ${message}${metaStr}`);
    }

    // === GESTION DES FLUX ===

    writeToStream(category, data) {
        const stream = this.logStreams.get(category);
        if (stream && stream.writable) {
            stream.write(data);
        }
    }

    // === ROTATION DES LOGS ===

    startLogRotation() {
        // Vérifier la rotation toutes les heures
        setInterval(() => {
            this.checkLogRotation();
        }, 60 * 60 * 1000);

        // Rotation quotidienne à minuit
        setInterval(() => {
            this.dailyRotation();
        }, 24 * 60 * 60 * 1000);
    }

    checkLogRotation() {
        for (const [category, filePath] of Object.entries(this.logFiles)) {
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                
                if (stats.size > this.maxFileSize) {
                    this.rotateLog(category, filePath);
                }
            }
        }
    }

    rotateLog(category, filePath) {
        try {
            // Fermer le flux existant
            const stream = this.logStreams.get(category);
            if (stream) {
                stream.end();
            }

            // Renommer le fichier actuel
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const rotatedPath = `${filePath}.${timestamp}`;
            fs.renameSync(filePath, rotatedPath);

            // Créer un nouveau flux
            const newStream = fs.createWriteStream(filePath, { flags: 'a' });
            this.logStreams.set(category, newStream);

            this.info(`Log rotation effectuée: ${category}`, { originalFile: filePath, rotatedFile: rotatedPath });

        } catch (error) {
            console.error(`Erreur rotation log ${category}:`, error);
        }
    }

    dailyRotation() {
        // Fermer tous les flux
        for (const stream of this.logStreams.values()) {
            if (stream && stream.writable) {
                stream.end();
            }
        }

        // Réinitialiser les fichiers pour le nouveau jour
        this.logStreams.clear();
        this.initializeLogFiles();

        this.info('Rotation quotidienne des logs effectuée');
    }

    // === NETTOYAGE ===

    cleanupOldLogs() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.maxFiles);

        let deletedCount = 0;

        const scanDirectory = (dir) => {
            if (!fs.existsSync(dir)) return;

            const files = fs.readdirSync(dir);
            
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);

                if (stats.isDirectory()) {
                    scanDirectory(filePath);
                } else if (stats.mtime < cutoffDate && file.endsWith('.log')) {
                    try {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    } catch (error) {
                        this.error(`Erreur suppression log: ${filePath}`, { error: error.message });
                    }
                }
            }
        };

        scanDirectory(this.logsDir);
        
        if (deletedCount > 0) {
            this.info(`Nettoyage des logs: ${deletedCount} fichiers supprimés`);
        }

        return deletedCount;
    }

    // === ANALYSE DES LOGS ===

    analyzeToday() {
        const today = new Date().toISOString().split('T')[0];
        const logFile = path.join(this.logsDir, `main_${today}.log`);

        if (!fs.existsSync(logFile)) {
            return { error: 'Aucun log pour aujourd\'hui' };
        }

        try {
            const content = fs.readFileSync(logFile, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());

            const analysis = {
                totalEntries: lines.length,
                errors: 0,
                warnings: 0,
                info: 0,
                debug: 0,
                trace: 0,
                errorMessages: [],
                warningMessages: [],
                hourlyStats: {},
                topErrors: {}
            };

            for (const line of lines) {
                const match = line.match(/\[(.*?)\] (\w+)\s+(.*)/);
                if (!match) continue;

                const [, timestamp, level, message] = match;
                const hour = new Date(timestamp).getHours();

                // Statistiques par niveau
                switch (level) {
                    case 'ERROR':
                        analysis.errors++;
                        analysis.errorMessages.push(message);
                        break;
                    case 'WARN':
                        analysis.warnings++;
                        analysis.warningMessages.push(message);
                        break;
                    case 'INFO':
                        analysis.info++;
                        break;
                    case 'DEBUG':
                        analysis.debug++;
                        break;
                    case 'TRACE':
                        analysis.trace++;
                        break;
                }

                // Statistiques horaires
                analysis.hourlyStats[hour] = (analysis.hourlyStats[hour] || 0) + 1;

                // Top des erreurs
                if (level === 'ERROR') {
                    const errorKey = message.split('|')[0].trim();
                    analysis.topErrors[errorKey] = (analysis.topErrors[errorKey] || 0) + 1;
                }
            }

            // Trier les erreurs par fréquence
            analysis.topErrors = Object.entries(analysis.topErrors)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .reduce((obj, [key, value]) => {
                    obj[key] = value;
                    return obj;
                }, {});

            return analysis;

        } catch (error) {
            return { error: `Erreur analyse logs: ${error.message}` };
        }
    }

    searchLogs(query, options = {}) {
        const {
            startDate = null,
            endDate = null,
            level = null,
            category = 'main',
            maxResults = 100
        } = options;

        const results = [];
        const logFiles = this.getLogFiles(startDate, endDate, category);

        for (const logFile of logFiles) {
            if (!fs.existsSync(logFile)) continue;

            try {
                const content = fs.readFileSync(logFile, 'utf8');
                const lines = content.split('\n');

                for (let i = 0; i < lines.length && results.length < maxResults; i++) {
                    const line = lines[i];
                    
                    if (!line.includes(query)) continue;
                    if (level && !line.includes(level)) continue;

                    const match = line.match(/\[(.*?)\] (\w+)\s+(.*)/);
                    if (match) {
                        const [, timestamp, logLevel, message] = match;
                        const logDate = new Date(timestamp);

                        if (startDate && logDate < startDate) continue;
                        if (endDate && logDate > endDate) continue;

                        results.push({
                            timestamp,
                            level: logLevel,
                            message,
                            file: logFile,
                            line: i + 1
                        });
                    }
                }
            } catch (error) {
                this.error(`Erreur recherche dans ${logFile}`, { error: error.message });
            }
        }

        return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    getLogFiles(startDate, endDate, category) {
        const files = [];
        
        if (!startDate && !endDate) {
            // Fichier du jour
            const today = new Date().toISOString().split('T')[0];
            files.push(this.logFiles[category] || path.join(this.logsDir, `${category}_${today}.log`));
        } else {
            // Scanner la plage de dates
            const currentDate = new Date(startDate || new Date());
            const end = new Date(endDate || new Date());

            while (currentDate <= end) {
                const dateStr = currentDate.toISOString().split('T')[0];
                const logFile = path.join(this.logsDir, category, `${category}_${dateStr}.log`);
                files.push(logFile);
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        return files;
    }

    // === STATISTIQUES ===

    getStats() {
        const uptime = Date.now() - this.logStats.startTime;
        
        return {
            ...this.logStats,
            uptimeMs: uptime,
            uptimeFormatted: this.formatDuration(uptime),
            logsPerSecond: this.logStats.totalLogs / (uptime / 1000),
            errorRate: (this.logStats.errorCount / this.logStats.totalLogs * 100).toFixed(2) + '%',
            logFiles: Object.keys(this.logFiles).length,
            logStreams: this.logStreams.size
        };
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}j ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    // === CONFIGURATION ===

    setLogLevel(level) {
        if (this.logLevels.hasOwnProperty(level.toUpperCase())) {
            this.currentLevel = this.logLevels[level.toUpperCase()];
            this.info(`Niveau de log changé: ${level.toUpperCase()}`);
            return true;
        }
        return false;
    }

    getLogLevel() {
        const levels = Object.entries(this.logLevels);
        const current = levels.find(([, value]) => value === this.currentLevel);
        return current ? current[0] : 'UNKNOWN';
    }

    // === FERMETURE PROPRE ===

    close() {
        for (const stream of this.logStreams.values()) {
            if (stream && stream.writable) {
                stream.end();
            }
        }
        this.logStreams.clear();
    }
}

module.exports = AdvancedLogger;
