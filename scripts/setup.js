const fs = require('fs');
const path = require('path');
const readline = require('readline');

class SetupWizard {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        this.config = {};
        this.rootDir = path.join(__dirname, '..');
    }

    async start() {
        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    🤖 FSPROTECT BOT SETUP                     ║
║              Configuration Assistant v2.0                    ║
╚═══════════════════════════════════════════════════════════════╝

Bienvenue dans l'assistant de configuration FSProtect Bot !
Cet assistant va vous guider à travers la configuration complète.

`);

        try {
            await this.collectBasicConfig();
            await this.collectDiscordConfig();
            await this.collectDatabaseConfig();
            await this.collectAIConfig();
            await this.collectIntegrationConfig();
            await this.collectChannelConfig();
            await this.generateConfigFiles();
            await this.createDirectories();
            await this.generateSecrets();
            await this.displaySummary();
            
            console.log('✅ Configuration terminée avec succès !');
            console.log('\\n🚀 Vous pouvez maintenant démarrer le bot avec: npm start');
            
        } catch (error) {
            console.error('❌ Erreur durant la configuration:', error.message);
        } finally {
            this.rl.close();
        }
    }

    async collectBasicConfig() {
        console.log('\\n📋 CONFIGURATION DE BASE');
        console.log('='.repeat(50));
        
        this.config.BOT_PREFIX = await this.question('Préfixe du bot (défaut: !) : ') || '!';
        this.config.NODE_ENV = await this.question('Environnement (development/production) [production] : ') || 'production';
        
        const features = await this.question('Fonctionnalités à activer (ai,economy,moderation,tickets,webhooks,backup) [toutes] : ');
        if (features) {
            const enabledFeatures = features.split(',').map(f => f.trim());
            this.config.FEATURE_AI_ENABLED = enabledFeatures.includes('ai') ? 'true' : 'false';
            this.config.FEATURE_ECONOMY_ENABLED = enabledFeatures.includes('economy') ? 'true' : 'false';
            this.config.FEATURE_MODERATION_ENABLED = enabledFeatures.includes('moderation') ? 'true' : 'false';
            this.config.FEATURE_TICKETS_ENABLED = enabledFeatures.includes('tickets') ? 'true' : 'false';
            this.config.FEATURE_WEBHOOKS_ENABLED = enabledFeatures.includes('webhooks') ? 'true' : 'false';
            this.config.FEATURE_BACKUP_ENABLED = enabledFeatures.includes('backup') ? 'true' : 'false';
        } else {
            // Activer toutes les fonctionnalités par défaut
            this.config.FEATURE_AI_ENABLED = 'true';
            this.config.FEATURE_ECONOMY_ENABLED = 'true';
            this.config.FEATURE_MODERATION_ENABLED = 'true';
            this.config.FEATURE_TICKETS_ENABLED = 'true';
            this.config.FEATURE_WEBHOOKS_ENABLED = 'true';
            this.config.FEATURE_BACKUP_ENABLED = 'true';
        }
    }

    async collectDiscordConfig() {
        console.log('\\n🤖 CONFIGURATION DISCORD');
        console.log('='.repeat(50));
        
        console.log('Rendez-vous sur https://discord.com/developers/applications pour créer votre bot');
        
        this.config.DISCORD_TOKEN = await this.question('Token du bot Discord : ', true);
        this.config.DISCORD_CLIENT_ID = await this.question('ID Client Discord : ', true);
        this.config.DISCORD_GUILD_ID = await this.question('ID du serveur principal (optionnel) : ');
        this.config.BOT_OWNER_ID = await this.question('Votre ID utilisateur Discord : ', true);
    }

    async collectDatabaseConfig() {
        console.log('\\n🗄️ CONFIGURATION BASE DE DONNÉES');
        console.log('='.repeat(50));
        
        const dbType = await this.question('Type de base de données (json/mysql/mongodb/sqlite) [json] : ') || 'json';
        this.config.DB_TYPE = dbType;
        
        if (dbType !== 'json') {
            this.config.DB_HOST = await this.question('Host de la base de données [localhost] : ') || 'localhost';
            this.config.DB_PORT = await this.question('Port de la base de données : ');
            this.config.DB_NAME = await this.question('Nom de la base de données : ', true);
            this.config.DB_USER = await this.question('Utilisateur de la base de données : ', true);
            this.config.DB_PASS = await this.question('Mot de passe de la base de données : ', true);
        }
    }

    async collectAIConfig() {
        if (this.config.FEATURE_AI_ENABLED === 'true') {
            console.log('\\n🧠 CONFIGURATION IA (OPENAI)');
            console.log('='.repeat(50));
            
            console.log('Obtenez votre clé API sur https://platform.openai.com/api-keys');
            
            this.config.OPENAI_API_KEY = await this.question('Clé API OpenAI : ', true);
            this.config.OPENAI_MODEL = await this.question('Modèle OpenAI (gpt-3.5-turbo/gpt-4) [gpt-3.5-turbo] : ') || 'gpt-3.5-turbo';
            this.config.OPENAI_MAX_TOKENS = await this.question('Tokens maximum par réponse [150] : ') || '150';
        }
    }

    async collectIntegrationConfig() {
        console.log('\\n🔗 INTÉGRATIONS OPTIONNELLES');
        console.log('='.repeat(50));
        
        const setupPayments = await this.question('Configurer les paiements Stripe ? (y/n) [n] : ');
        if (setupPayments.toLowerCase() === 'y') {
            this.config.STRIPE_SECRET_KEY = await this.question('Clé secrète Stripe : ', true);
            this.config.STRIPE_WEBHOOK_SECRET = await this.question('Secret webhook Stripe : ', true);
        }
        
        const setupEmail = await this.question('Configurer l\'envoi d\'emails ? (y/n) [n] : ');
        if (setupEmail.toLowerCase() === 'y') {
            this.config.SMTP_HOST = await this.question('Serveur SMTP [smtp.gmail.com] : ') || 'smtp.gmail.com';
            this.config.SMTP_PORT = await this.question('Port SMTP [587] : ') || '587';
            this.config.SMTP_USER = await this.question('Email SMTP : ', true);
            this.config.SMTP_PASS = await this.question('Mot de passe SMTP : ', true);
            this.config.FROM_EMAIL = await this.question('Email expéditeur : ', true);
        }
        
        this.config.WEBHOOK_PORT = await this.question('Port pour le serveur webhook [3001] : ') || '3001';
    }

    async collectChannelConfig() {
        console.log('\\n📺 CONFIGURATION DES CANAUX');
        console.log('='.repeat(50));
        console.log('Configurez les IDs des canaux Discord (optionnel, peut être fait plus tard)');
        
        this.config.SYSTEM_CHANNEL_ID = await this.question('Canal système (logs du bot) : ');
        this.config.LOGS_CHANNEL_ID = await this.question('Canal logs (actions des utilisateurs) : ');
        this.config.MODERATION_CHANNEL_ID = await this.question('Canal modération : ');
        this.config.WELCOME_CHANNEL_ID = await this.question('Canal bienvenue : ');
        this.config.TICKETS_CATEGORY_ID = await this.question('Catégorie tickets : ');
    }

    async generateConfigFiles() {
        console.log('\\n📄 GÉNÉRATION DES FICHIERS DE CONFIGURATION');
        console.log('='.repeat(50));
        
        // Générer le fichier .env
        await this.generateEnvFile();
        
        // Générer la configuration bot
        await this.generateBotConfig();
        
        console.log('✅ Fichiers de configuration générés');
    }

    async generateEnvFile() {
        const envTemplate = fs.readFileSync(path.join(this.rootDir, '.env.example'), 'utf8');
        let envContent = envTemplate;
        
        // Remplacer les valeurs avec la configuration collectée
        for (const [key, value] of Object.entries(this.config)) {
            const regex = new RegExp(`${key}=.*`, 'g');
            envContent = envContent.replace(regex, `${key}=${value}`);
        }
        
        fs.writeFileSync(path.join(this.rootDir, '.env'), envContent);
    }

    async generateBotConfig() {
        const botConfig = {
            version: '2.0.0',
            setupDate: new Date().toISOString(),
            features: {
                ai: this.config.FEATURE_AI_ENABLED === 'true',
                economy: this.config.FEATURE_ECONOMY_ENABLED === 'true',
                moderation: this.config.FEATURE_MODERATION_ENABLED === 'true',
                tickets: this.config.FEATURE_TICKETS_ENABLED === 'true',
                webhooks: this.config.FEATURE_WEBHOOKS_ENABLED === 'true',
                backup: this.config.FEATURE_BACKUP_ENABLED === 'true'
            },
            database: {
                type: this.config.DB_TYPE
            },
            channels: {
                system: this.config.SYSTEM_CHANNEL_ID,
                logs: this.config.LOGS_CHANNEL_ID,
                moderation: this.config.MODERATION_CHANNEL_ID,
                welcome: this.config.WELCOME_CHANNEL_ID,
                tickets: this.config.TICKETS_CATEGORY_ID
            }
        };
        
        const configDir = path.join(this.rootDir, 'config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        fs.writeFileSync(
            path.join(configDir, 'bot.json'),
            JSON.stringify(botConfig, null, 2)
        );
    }

    async createDirectories() {
        console.log('\\n📁 CRÉATION DES DOSSIERS');
        console.log('='.repeat(50));
        
        const directories = [
            'data',
            'logs',
            'logs/errors',
            'logs/system', 
            'logs/commands',
            'logs/moderation',
            'logs/security',
            'logs/performance',
            'backups',
            'config',
            'temp',
            'uploads'
        ];
        
        for (const dir of directories) {
            const dirPath = path.join(this.rootDir, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                console.log(`📁 Créé: ${dir}`);
            }
        }
    }

    async generateSecrets() {
        console.log('\\n🔐 GÉNÉRATION DES SECRETS');
        console.log('='.repeat(50));
        
        const crypto = require('crypto');
        
        if (!this.config.JWT_SECRET) {
            this.config.JWT_SECRET = crypto.randomBytes(64).toString('hex');
        }
        
        if (!this.config.ENCRYPTION_KEY) {
            this.config.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
        }
        
        if (!this.config.WEBHOOK_SECRET) {
            this.config.WEBHOOK_SECRET = crypto.randomBytes(32).toString('hex');
        }
        
        if (!this.config.BACKUP_PASSWORD) {
            this.config.BACKUP_PASSWORD = crypto.randomBytes(16).toString('hex');
        }
        
        // Mettre à jour le fichier .env avec les secrets générés
        await this.generateEnvFile();
        
        console.log('🔐 Secrets générés et sauvegardés');
    }

    async displaySummary() {
        console.log('\\n📋 RÉSUMÉ DE LA CONFIGURATION');
        console.log('='.repeat(50));
        
        console.log(`
🤖 Bot Discord:
   - Préfixe: ${this.config.BOT_PREFIX}
   - Environnement: ${this.config.NODE_ENV}
   - Propriétaire: ${this.config.BOT_OWNER_ID}

🗄️ Base de données:
   - Type: ${this.config.DB_TYPE}

🧠 Intelligence Artificielle:
   - Activée: ${this.config.FEATURE_AI_ENABLED}
   - Modèle: ${this.config.OPENAI_MODEL || 'Non configuré'}

🌐 Serveur Webhook:
   - Port: ${this.config.WEBHOOK_PORT}

📁 Dossiers créés:
   - data/ (données du bot)
   - logs/ (journaux)
   - backups/ (sauvegardes)
   - config/ (configuration)

🔐 Sécurité:
   - Secrets générés automatiquement
   - Chiffrement activé pour les sauvegardes
        `);
    }

    question(prompt, required = false) {
        return new Promise((resolve) => {
            const ask = () => {
                this.rl.question(prompt, (answer) => {
                    if (required && !answer.trim()) {
                        console.log('⚠️ Cette information est requise.');
                        ask();
                    } else {
                        resolve(answer.trim());
                    }
                });
            };
            ask();
        });
    }
}

// Installation automatique des dépendances
async function installDependencies() {
    console.log('\\n📦 INSTALLATION DES DÉPENDANCES');
    console.log('='.repeat(50));
    
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
        console.log('Installation en cours... (cela peut prendre quelques minutes)');
        
        const npm = spawn('npm', ['install'], {
            stdio: 'inherit',
            shell: true
        });
        
        npm.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Dépendances installées avec succès');
                resolve();
            } else {
                console.log('❌ Erreur lors de l\'installation des dépendances');
                reject(new Error(`NPM install failed with code ${code}`));
            }
        });
    });
}

// Script principal
async function main() {
    try {
        // Vérifier si package.json existe
        const packagePath = path.join(__dirname, '..', 'package.json');
        if (!fs.existsSync(packagePath)) {
            console.log('📦 Copie du package.json...');
            fs.copyFileSync(
                path.join(__dirname, '..', 'package_complete.json'),
                packagePath
            );
        }
        
        // Installer les dépendances
        await installDependencies();
        
        // Lancer l'assistant de configuration
        const wizard = new SetupWizard();
        await wizard.start();
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'installation:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = SetupWizard;
