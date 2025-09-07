/**
 * Système de logging simple
 */

const fs = require('fs');
const path = require('path');

class LoggingSystem {
    constructor() {
        this.logDir = path.join(__dirname, '../logs');
        this.logLevel = 'INFO';
        this.maxLogSize = 10 * 1024 * 1024; // 10MB
        this.maxLogFiles = 30;
        
        this.createLogDirectory();
    }

    /**
     * Crée le répertoire de logs s'il n'existe pas
     */
    createLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    /**
     * Écrit un log
     */
    log(level, message, extra = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...extra
        };

        // Log vers la console
        console.log(`[${timestamp}] ${level}: ${message}`);

        // Log vers fichier
        this.writeToFile(logEntry);
    }

    /**
     * Log niveau INFO
     */
    info(message, extra = {}) {
        this.log('INFO', message, extra);
    }

    /**
     * Log niveau WARN
     */
    warn(message, extra = {}) {
        this.log('WARN', message, extra);
    }

    /**
     * Log niveau ERROR
     */
    error(message, extra = {}) {
        this.log('ERROR', message, extra);
    }

    /**
     * Log niveau DEBUG
     */
    debug(message, extra = {}) {
        if (this.logLevel === 'DEBUG') {
            this.log('DEBUG', message, extra);
        }
    }

    /**
     * Écrit vers un fichier de log
     */
    writeToFile(logEntry) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const logFile = path.join(this.logDir, `fsprotect-${today}.log`);
            
            const logLine = JSON.stringify(logEntry) + '\n';
            fs.appendFileSync(logFile, logLine);
            
            this.rotateLogsIfNeeded(logFile);
        } catch (error) {
            console.error('Erreur lors de l\'écriture du log:', error);
        }
    }

    /**
     * Rotation des logs si nécessaire
     */
    rotateLogsIfNeeded(logFile) {
        try {
            const stats = fs.statSync(logFile);
            if (stats.size > this.maxLogSize) {
                const timestamp = Date.now();
                const newName = logFile.replace('.log', `-${timestamp}.log`);
                fs.renameSync(logFile, newName);
            }

            this.cleanOldLogs();
        } catch (error) {
            console.error('Erreur lors de la rotation des logs:', error);
        }
    }

    /**
     * Nettoie les anciens logs
     */
    cleanOldLogs() {
        try {
            const files = fs.readdirSync(this.logDir)
                .filter(file => file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.logDir, file),
                    time: fs.statSync(path.join(this.logDir, file)).mtime
                }))
                .sort((a, b) => b.time - a.time);

            if (files.length > this.maxLogFiles) {
                const filesToDelete = files.slice(this.maxLogFiles);
                filesToDelete.forEach(file => {
                    fs.unlinkSync(file.path);
                });
            }
        } catch (error) {
            console.error('Erreur lors du nettoyage des logs:', error);
        }
    }

    /**
     * Log des événements du bot
     */
    logBotEvent(event, data) {
        this.info(`Bot Event: ${event}`, { event, data });
    }

    /**
     * Log des commandes
     */
    logCommand(userId, command, success = true) {
        this.info(`Command executed: ${command}`, {
            userId,
            command,
            success,
            type: 'command'
        });
    }

    /**
     * Log des erreurs système
     */
    logSystemError(error, context = {}) {
        this.error(`System Error: ${error.message}`, {
            error: error.stack,
            context,
            type: 'system_error'
        });
    }

    /**
     * Log des paiements
     */
    logPayment(userId, amount, method, status) {
        this.info(`Payment: ${status}`, {
            userId,
            amount,
            method,
            status,
            type: 'payment'
        });
    }

    /**
     * Statistiques des logs
     */
    getStats() {
        try {
            const files = fs.readdirSync(this.logDir);
            const totalSize = files.reduce((size, file) => {
                const filePath = path.join(this.logDir, file);
                return size + fs.statSync(filePath).size;
            }, 0);

            return {
                logFiles: files.length,
                totalSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
                logDirectory: this.logDir,
                logLevel: this.logLevel
            };
        } catch (error) {
            return { error: 'Impossible de lire les statistiques des logs' };
        }
    }
}

module.exports = LoggingSystem;
