const fs = require('fs');
const path = require('path');
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');
const zlib = require('zlib');
const crypto = require('crypto');

class BackupSystem {
    constructor() {
        this.backupDir = path.join(__dirname, '..', 'backups');
        this.dataDir = path.join(__dirname, '..', 'data');
        this.configDir = path.join(__dirname, '..', 'config');
        this.logsDir = path.join(__dirname, '..', 'logs');
        
        this.backupConfig = {
            retentionDays: 30,
            autoBackupInterval: 24 * 60 * 60 * 1000, // 24h
            compressionLevel: 6,
            encryptBackups: true,
            maxBackupSize: 100 * 1024 * 1024, // 100MB
            excludePatterns: ['.tmp', '.log', 'node_modules']
        };

        this.scheduleAutoBackup();
        this.ensureDirectories();
    }

    ensureDirectories() {
        [this.backupDir, this.dataDir, this.configDir, this.logsDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    // === CRÉATION DE SAUVEGARDES ===

    async createBackup(type = 'full', description = '') {
        if (type === 'shutdown') {
            // On ignore ou on log simplement la demande de sauvegarde à l'arrêt
            console.log('Sauvegarde ignorée pour le type shutdown.');
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupId = `backup_${type}_${timestamp}`;
        const backupPath = path.join(this.backupDir, backupId);

        try {
            // Créer le dossier de sauvegarde
            fs.mkdirSync(backupPath, { recursive: true });

            const manifest = {
                id: backupId,
                type,
                description,
                createdAt: new Date().toISOString(),
                files: [],
                checksum: '',
                encrypted: this.backupConfig.encryptBackups,
                size: 0
            };

            // Sauvegarder selon le type
            switch (type) {
                case 'full':
                    await this.backupFull(backupPath, manifest);
                    break;
                case 'data':
                    await this.backupData(backupPath, manifest);
                    break;
                case 'config':
                    await this.backupConfig(backupPath, manifest);
                    break;
                case 'logs':
                    await this.backupLogs(backupPath, manifest);
                    break;
                case 'database':
                    await this.backupDatabase(backupPath, manifest);
                    break;
                default:
                    throw new Error(`Type de sauvegarde non supporté: ${type}`);
            }

            // Calculer le checksum et la taille
            manifest.checksum = await this.calculateDirectoryChecksum(backupPath);
            manifest.size = await this.getDirectorySize(backupPath);

            // Sauvegarder le manifest
            fs.writeFileSync(
                path.join(backupPath, 'manifest.json'),
                JSON.stringify(manifest, null, 2)
            );

            // Compresser si nécessaire
            if (manifest.size > 10 * 1024 * 1024) { // 10MB
                await this.compressBackup(backupPath);
            }

            // Chiffrer si activé
            if (this.backupConfig.encryptBackups) {
                await this.encryptBackup(backupPath);
            }

            // Nettoyer les anciennes sauvegardes
            await this.cleanupOldBackups();

            return {
                success: true,
                backupId,
                manifest,
                path: backupPath
            };

        } catch (error) {
            console.error('Erreur création sauvegarde:', error);
            
            // Nettoyer en cas d'erreur
            if (fs.existsSync(backupPath)) {
                fs.rmSync(backupPath, { recursive: true, force: true });
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    async backupFull(backupPath, manifest) {
        const directories = [
            { src: this.dataDir, dest: 'data' },
            { src: this.configDir, dest: 'config' },
            { src: this.logsDir, dest: 'logs' },
            { src: path.join(__dirname, '..', 'systems'), dest: 'systems' },
            { src: path.join(__dirname, '..', 'utils'), dest: 'utils' },
            { src: path.join(__dirname, '..', 'languages'), dest: 'languages' }
        ];

        for (const { src, dest } of directories) {
            if (fs.existsSync(src)) {
                const destPath = path.join(backupPath, dest);
                await this.copyDirectory(src, destPath, manifest);
            }
        }

        // Sauvegarder les fichiers racine importants
        const rootFiles = ['index.js', 'package.json', 'package-lock.json', '.env.example'];
        const rootSrc = path.join(__dirname, '..');
        
        for (const file of rootFiles) {
            const srcFile = path.join(rootSrc, file);
            if (fs.existsSync(srcFile)) {
                const destFile = path.join(backupPath, file);
                await this.copyFile(srcFile, destFile, manifest);
            }
        }
    }

    async backupData(backupPath, manifest) {
        if (fs.existsSync(this.dataDir)) {
            await this.copyDirectory(this.dataDir, path.join(backupPath, 'data'), manifest);
        }
    }

    async backupConfig(backupPath, manifest) {
        if (fs.existsSync(this.configDir)) {
            await this.copyDirectory(this.configDir, path.join(backupPath, 'config'), manifest);
        }

        // Inclure les fichiers de configuration racine
        const configFiles = ['package.json', '.env.example'];
        const rootSrc = path.join(__dirname, '..');
        
        for (const file of configFiles) {
            const srcFile = path.join(rootSrc, file);
            if (fs.existsSync(srcFile)) {
                const destFile = path.join(backupPath, file);
                await this.copyFile(srcFile, destFile, manifest);
            }
        }
    }

    async backupLogs(backupPath, manifest) {
        if (fs.existsSync(this.logsDir)) {
            await this.copyDirectory(this.logsDir, path.join(backupPath, 'logs'), manifest);
        }
    }

    async backupDatabase(backupPath, manifest) {
        const dbFiles = [
            'database.json',
            'users.json',
            'tickets.json',
            'economy.json',
            'permissions.json',
            'obfuscation_history.json'
        ];

        for (const file of dbFiles) {
            const srcFile = path.join(this.dataDir, file);
            if (fs.existsSync(srcFile)) {
                const destFile = path.join(backupPath, file);
                await this.copyFile(srcFile, destFile, manifest);
            }
        }
    }

    // === RESTAURATION ===

    async restoreBackup(backupId, options = {}) {
        const backupPath = this.getBackupPath(backupId);
        
        if (!fs.existsSync(backupPath)) {
            throw new Error(`Sauvegarde ${backupId} non trouvée`);
        }

        try {
            // Déchiffrer si nécessaire
            let workingPath = backupPath;
            if (this.isEncrypted(backupPath)) {
                workingPath = await this.decryptBackup(backupPath);
            }

            // Décompresser si nécessaire
            if (this.isCompressed(workingPath)) {
                workingPath = await this.decompressBackup(workingPath);
            }

            // Lire le manifest
            const manifestPath = path.join(workingPath, 'manifest.json');
            if (!fs.existsSync(manifestPath)) {
                throw new Error('Manifest de sauvegarde non trouvé');
            }

            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

            // Vérifier l'intégrité
            if (options.verifyIntegrity !== false) {
                const isValid = await this.verifyBackupIntegrity(workingPath, manifest);
                if (!isValid) {
                    throw new Error('Intégrité de la sauvegarde compromise');
                }
            }

            // Créer une sauvegarde de sécurité avant restauration
            if (options.createSafety !== false) {
                await this.createBackup('full', 'Sauvegarde automatique avant restauration');
            }

            // Restaurer les fichiers
            await this.performRestore(workingPath, manifest, options);

            return {
                success: true,
                restored: manifest.files.length,
                manifest
            };

        } catch (error) {
            console.error('Erreur restauration:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async performRestore(backupPath, manifest, options) {
        const restoreMap = {
        };

        // Restaurer les dossiers
        for (const [folder, destPath] of Object.entries(restoreMap)) {
            const srcPath = path.join(backupPath, folder);
            if (fs.existsSync(srcPath)) {
                if (options.overwrite !== false) {
                    // Supprimer le dossier existant
                    if (fs.existsSync(destPath)) {
                        fs.rmSync(destPath, { recursive: true, force: true });
                    }
                }
                await this.copyDirectory(srcPath, destPath);
            }
        }

        // Restaurer les fichiers racine
        const rootFiles = ['index.js', 'package.json', 'package-lock.json'];
        const rootDest = path.join(__dirname, '..');
        
        for (const file of rootFiles) {
            const srcFile = path.join(backupPath, file);
            const destFile = path.join(rootDest, file);
            
            if (fs.existsSync(srcFile)) {
                if (options.overwrite !== false || !fs.existsSync(destFile)) {
                    await this.copyFile(srcFile, destFile);
                }
            }
        }
    }

    // === UTILITAIRES ===

    async copyDirectory(src, dest, manifest = null) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        const items = fs.readdirSync(src);

        for (const item of items) {
            const srcPath = path.join(src, item);
            const destPath = path.join(dest, item);
            const stat = fs.statSync(srcPath);

            if (this.shouldExclude(item)) {
                continue;
            }

            if (stat.isDirectory()) {
                await this.copyDirectory(srcPath, destPath, manifest);
            } else {
                await this.copyFile(srcPath, destPath, manifest);
            }
        }
    }

    async copyFile(src, dest, manifest = null) {
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        fs.copyFileSync(src, dest);

        if (manifest) {
            const stat = fs.statSync(dest);
            manifest.files.push({
                path: path.relative(path.dirname(manifest.id || ''), dest),
                size: stat.size,
                modified: stat.mtime.toISOString(),
                checksum: await this.calculateFileChecksum(dest)
            });
        }
    }

    shouldExclude(item) {
        return this.backupConfig.excludePatterns.some(pattern => 
            item.includes(pattern) || item.endsWith(pattern)
        );
    }

    async calculateFileChecksum(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = createReadStream(filePath);
            
            stream.on('data', data => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    async calculateDirectoryChecksum(dirPath) {
        const files = await this.getAllFiles(dirPath);
        const checksums = [];

        for (const file of files) {
            const checksum = await this.calculateFileChecksum(file);
            checksums.push(`${path.relative(dirPath, file)}:${checksum}`);
        }

        const hash = crypto.createHash('sha256');
        hash.update(checksums.sort().join('\n'));
        return hash.digest('hex');
    }

    async getAllFiles(dirPath) {
        const files = [];
        
        const scan = (dir) => {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scan(fullPath);
                } else {
                    files.push(fullPath);
                }
            }
        };

        scan(dirPath);
        return files;
    }

    async getDirectorySize(dirPath) {
        const files = await this.getAllFiles(dirPath);
        let totalSize = 0;

        for (const file of files) {
            const stat = fs.statSync(file);
            totalSize += stat.size;
        }

        return totalSize;
    }

    // === COMPRESSION ===

    async compressBackup(backupPath) {
        const archivePath = `${backupPath}.tar.gz`;
        
        return new Promise((resolve, reject) => {
            const gzip = zlib.createGzip({ level: this.backupConfig.compressionLevel });
            const output = createWriteStream(archivePath);
            
            // TODO: Implémenter la création d'archive tar
            // Pour l'instant, on compresse juste le manifest
            const manifestPath = path.join(backupPath, 'manifest.json');
            const input = createReadStream(manifestPath);
            
            pipeline(input, gzip, output, (err) => {
                if (err) reject(err);
                else resolve(archivePath);
            });
        });
    }

    async decompressBackup(backupPath) {
        // TODO: Implémenter la décompression
        return backupPath;
    }

    // === CHIFFREMENT ===

    async encryptBackup(backupPath) {
        const password = process.env.BACKUP_PASSWORD || 'default_backup_key';
        const algorithm = 'aes-256-gcm';
        
        const files = await this.getAllFiles(backupPath);
        
        for (const file of files) {
            if (path.basename(file) === 'manifest.json') continue;
            
            const data = fs.readFileSync(file);
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher(algorithm, password);
            
            let encrypted = cipher.update(data);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            
            fs.writeFileSync(file + '.enc', Buffer.concat([iv, encrypted]));
            fs.unlinkSync(file);
        }
    }

    async decryptBackup(backupPath) {
        // TODO: Implémenter le déchiffrement
        return backupPath;
    }

    // === GESTION DES SAUVEGARDES ===

    listBackups() {
        if (!fs.existsSync(this.backupDir)) {
            return [];
        }

        const backups = [];
        const items = fs.readdirSync(this.backupDir);

        for (const item of items) {
            const itemPath = path.join(this.backupDir, item);
            const stat = fs.statSync(itemPath);

            if (stat.isDirectory()) {
                const manifestPath = path.join(itemPath, 'manifest.json');
                if (fs.existsSync(manifestPath)) {
                    try {
                        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                        backups.push({
                            ...manifest,
                            path: itemPath,
                            sizeFormatted: this.formatBytes(manifest.size)
                        });
                    } catch (error) {
                        console.error(`Erreur lecture manifest ${item}:`, error);
                    }
                }
            }
        }

        return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    async deleteBackup(backupId) {
        const backupPath = this.getBackupPath(backupId);
        
        if (fs.existsSync(backupPath)) {
            fs.rmSync(backupPath, { recursive: true, force: true });
            return true;
        }
        
        return false;
    }

    async cleanupOldBackups() {
        const backups = this.listBackups();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.backupConfig.retentionDays);

        let deletedCount = 0;

        for (const backup of backups) {
            const backupDate = new Date(backup.createdAt);
            
            if (backupDate < cutoffDate) {
                await this.deleteBackup(backup.id);
                deletedCount++;
            }
        }

        return deletedCount;
    }

    getBackupPath(backupId) {
        return path.join(this.backupDir, backupId);
    }

    isEncrypted(backupPath) {
        const files = fs.readdirSync(backupPath);
        return files.some(file => file.endsWith('.enc'));
    }

    isCompressed(backupPath) {
        return backupPath.endsWith('.tar.gz') || backupPath.endsWith('.zip');
    }

    async verifyBackupIntegrity(backupPath, manifest) {
        try {
            const currentChecksum = await this.calculateDirectoryChecksum(backupPath);
            return currentChecksum === manifest.checksum;
        } catch (error) {
            console.error('Erreur vérification intégrité:', error);
            return false;
        }
    }

    // === SAUVEGARDE AUTOMATIQUE ===

    scheduleAutoBackup() {
        setInterval(async () => {
            try {
                const result = await this.createBackup('full', 'Sauvegarde automatique');
                if (result.success) {
                    console.log(`✅ Sauvegarde automatique créée: ${result.backupId}`);
                } else {
                    console.error('❌ Échec sauvegarde automatique:', result.error);
                }
            } catch (error) {
                console.error('❌ Erreur sauvegarde automatique:', error);
            }
        }, this.backupConfig.autoBackupInterval);

        console.log('📅 Sauvegarde automatique programmée toutes les 24h');
    }

    // === UTILITAIRES ===

    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    getStorageStats() {
        const backups = this.listBackups();
        const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
        
        return {
            totalBackups: backups.length,
            totalSize,
            totalSizeFormatted: this.formatBytes(totalSize),
            oldestBackup: backups[backups.length - 1]?.createdAt,
            newestBackup: backups[0]?.createdAt,
            averageSize: backups.length > 0 ? totalSize / backups.length : 0,
            backupsByType: backups.reduce((acc, backup) => {
                acc[backup.type] = (acc[backup.type] || 0) + 1;
                return acc;
            }, {})
        };
    }

    // === EXPORT/IMPORT ===

    exportBackupConfig() {
        return {
            ...this.backupConfig,
            exportedAt: new Date().toISOString()
        };
    }

    importBackupConfig(config) {
        this.backupConfig = {
            ...this.backupConfig,
            ...config
        };
    }
}

module.exports = BackupSystem;
