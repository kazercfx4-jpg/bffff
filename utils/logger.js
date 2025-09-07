const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Logger {
    constructor() {
        this.logPath = './logs/';
        this.maxLogSize = 10 * 1024 * 1024; // 10MB
        this.maxLogFiles = 10;
        this.logLevels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3,
            TRACE: 4
        };
        this.currentLevel = this.logLevels.INFO;
        
        // Créer le dossier logs
        if (!fs.existsSync(this.logPath)) {
            fs.mkdirSync(this.logPath, { recursive: true });
        }
        
        // Rotation des logs à minuit
        this.scheduleLogRotation();
    }

    error(message, metadata = {}) {
        this.log('ERROR', message, metadata);
    }

    warn(message, metadata = {}) {
        this.log('WARN', message, metadata);
    }

    info(message, metadata = {}) {
        this.log('INFO', message, metadata);
    }

    debug(message, metadata = {}) {
        this.log('DEBUG', message, metadata);
    }

    trace(message, metadata = {}) {
        this.log('TRACE', message, metadata);
    }

    log(level, message, metadata = {}) {
        if (this.logLevels[level] > this.currentLevel) {
            return; // Log level trop bas
        }

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            metadata,
            pid: process.pid,
            sessionId: this.getSessionId()
        };

        // Formatter l'entrée de log
        const formattedLog = this.formatLogEntry(logEntry);
        
        // Écrire dans le fichier
        this.writeToFile(formattedLog);
        
        // Afficher dans la console avec couleurs
        this.writeToConsole(level, formattedLog);
    }

    formatLogEntry(entry) {
        const { timestamp, level, message, metadata, pid, sessionId } = entry;
        
        // Format JSON structuré
        const jsonLog = JSON.stringify({
            '@timestamp': timestamp,
            level: level,
            message: message,
            metadata: metadata,
            process: {
                pid: pid,
                sessionId: sessionId
            }
        });

        // Format lisible pour les fichiers
        const readableLog = `[${timestamp}] [${level.padEnd(5)}] [PID:${pid}] ${message}${
            Object.keys(metadata).length > 0 ? ' | ' + JSON.stringify(metadata) : ''
        }`;

        return { json: jsonLog, readable: readableLog };
    }

    writeToFile(formattedLog) {
        const today = new Date().toISOString().split('T')[0];
        const logFile = path.join(this.logPath, `fsprotect_${today}.log`);
        const jsonLogFile = path.join(this.logPath, `fsprotect_${today}.json`);

        try {
            // Log lisible
            fs.appendFileSync(logFile, formattedLog.readable + '\n');
            
            // Log JSON pour parsing automatique
            fs.appendFileSync(jsonLogFile, formattedLog.json + '\n');

            // Vérifier la taille du fichier
            this.checkLogRotation(logFile);
            this.checkLogRotation(jsonLogFile);
        } catch (error) {
            console.error('Erreur écriture log:', error);
        }
    }

    writeToConsole(level, formattedLog) {
        const colors = {
            ERROR: '\x1b[31m', // Rouge
            WARN: '\x1b[33m',  // Jaune
            INFO: '\x1b[36m',  // Cyan
            DEBUG: '\x1b[35m', // Magenta
            TRACE: '\x1b[37m'  // Blanc
        };
        
        const reset = '\x1b[0m';
        const color = colors[level] || colors.INFO;
        
        console.log(`${color}${formattedLog.readable}${reset}`);
    }

    checkLogRotation(filePath) {
        try {
            const stats = fs.statSync(filePath);
            if (stats.size > this.maxLogSize) {
                this.rotateLog(filePath);
            }
        } catch (error) {
            // Fichier n'existe pas encore
        }
    }

    rotateLog(filePath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = filePath.replace('.log', `_${timestamp}.log`).replace('.json', `_${timestamp}.json`);
        
        try {
            fs.renameSync(filePath, rotatedPath);
            this.info('Log rotated', { originalFile: filePath, rotatedFile: rotatedPath });
            
            // Nettoyer les anciens logs
            this.cleanOldLogs();
        } catch (error) {
            this.error('Erreur rotation log', { error: error.message, filePath });
        }
    }

    cleanOldLogs() {
        try {
            const files = fs.readdirSync(this.logPath)
                .filter(file => file.startsWith('fsprotect_') && (file.endsWith('.log') || file.endsWith('.json')))
                .map(file => ({
                    name: file,
                    path: path.join(this.logPath, file),
                    mtime: fs.statSync(path.join(this.logPath, file)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);

            // Garder seulement les N fichiers les plus récents
            if (files.length > this.maxLogFiles) {
                const filesToDelete = files.slice(this.maxLogFiles);
                for (const file of filesToDelete) {
                    fs.unlinkSync(file.path);
                    this.info('Ancien log supprimé', { file: file.name });
                }
            }
        } catch (error) {
            this.error('Erreur nettoyage logs', { error: error.message });
        }
    }

    scheduleLogRotation() {
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const msUntilMidnight = tomorrow.getTime() - now.getTime();

        setTimeout(() => {
            this.info('Rotation quotidienne des logs');
            this.cleanOldLogs();
            
            // Programmer la prochaine rotation
            setInterval(() => {
                this.cleanOldLogs();
            }, 24 * 60 * 60 * 1000); // Tous les jours
            
        }, msUntilMidnight);
    }

    getSessionId() {
        if (!this._sessionId) {
            this._sessionId = crypto.randomBytes(8).toString('hex');
        }
        return this._sessionId;
    }

    setLogLevel(level) {
        if (this.logLevels.hasOwnProperty(level)) {
            this.currentLevel = this.logLevels[level];
            this.info('Log level changed', { newLevel: level });
        }
    }

    // Méthodes spécialisées pour le bot
    logObfuscation(userId, fileName, preset, result) {
        this.info('Obfuscation completed', {
            userId,
            fileName,
            preset,
            filesProcessed: result.filesProcessed,
            processingTime: result.processingTime,
            finalSize: result.finalSize
        });
    }

    logCommand(interaction) {
        this.info('Command executed', {
            command: interaction.commandName,
            user: interaction.user.tag,
            userId: interaction.user.id,
            guild: interaction.guild?.name,
            guildId: interaction.guild?.id,
            channel: interaction.channel?.name,
            channelId: interaction.channel?.id
        });
    }

    logError(error, context = {}) {
        this.error('Application error', {
            message: error.message,
            stack: error.stack,
            context
        });
    }

    logSecurity(event, details = {}) {
        this.warn('Security event', {
            event,
            ...details,
            timestamp: new Date().toISOString()
        });
    }

    // Analyse des logs
    analyzeLogs(startDate, endDate) {
        try {
            const logs = this.readLogsInRange(startDate, endDate);
            
            return {
                totalEntries: logs.length,
                byLevel: this.groupByLevel(logs),
                byUser: this.groupByUser(logs),
                byCommand: this.groupByCommand(logs),
                errors: logs.filter(log => log.level === 'ERROR'),
                warnings: logs.filter(log => log.level === 'WARN'),
                topUsers: this.getTopUsers(logs),
                topCommands: this.getTopCommands(logs)
            };
        } catch (error) {
            this.error('Erreur analyse logs', { error: error.message });
            return null;
        }
    }

    readLogsInRange(startDate, endDate) {
        const logs = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Lire tous les fichiers de logs dans la plage
        const files = fs.readdirSync(this.logPath)
            .filter(file => file.endsWith('.json'))
            .sort();

        for (const file of files) {
            try {
                const content = fs.readFileSync(path.join(this.logPath, file), 'utf8');
                const lines = content.trim().split('\n');
                
                for (const line of lines) {
                    try {
                        const log = JSON.parse(line);
                        const logDate = new Date(log['@timestamp']);
                        
                        if (logDate >= start && logDate <= end) {
                            logs.push(log);
                        }
                    } catch (parseError) {
                        // Ligne invalide, ignorer
                    }
                }
            } catch (fileError) {
                this.error('Erreur lecture fichier log', { file, error: fileError.message });
            }
        }

        return logs;
    }

    groupByLevel(logs) {
        return logs.reduce((acc, log) => {
            acc[log.level] = (acc[log.level] || 0) + 1;
            return acc;
        }, {});
    }

    groupByUser(logs) {
        return logs.reduce((acc, log) => {
            const userId = log.metadata?.userId || log.metadata?.user;
            if (userId) {
                acc[userId] = (acc[userId] || 0) + 1;
            }
            return acc;
        }, {});
    }

    groupByCommand(logs) {
        return logs.reduce((acc, log) => {
            const command = log.metadata?.command;
            if (command) {
                acc[command] = (acc[command] || 0) + 1;
            }
            return acc;
        }, {});
    }

    getTopUsers(logs, limit = 10)