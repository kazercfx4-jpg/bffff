const axios = require('axios');
const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');

class WebhookSystem {
    constructor() {
        this.webhooks = new Map();
        this.apiKeys = new Map();
        this.rateLimits = new Map();
        this.webhookHistory = [];
        this.server = null;
        this.port = process.env.WEBHOOK_PORT || 3001;
        
        this.loadConfiguration();
        this.initializeServer();
        this.setupDefaultWebhooks();
    }

    loadConfiguration() {
        try {
            const configPath = path.join(__dirname, '..', 'data', 'webhooks.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                this.webhooks = new Map(config.webhooks || []);
                this.apiKeys = new Map(config.apiKeys || []);
                this.webhookHistory = config.history || [];
            }
        } catch (error) {
            console.error('Erreur chargement webhooks:', error);
        }
    }

    saveConfiguration() {
        try {
            const configPath = path.join(__dirname, '..', 'data', 'webhooks.json');
            const config = {
                webhooks: Array.from(this.webhooks.entries()),
                apiKeys: Array.from(this.apiKeys.entries()),
                history: this.webhookHistory.slice(-1000) // Garder les 1000 derniers
            };
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('Erreur sauvegarde webhooks:', error);
        }
    }

    // === SERVEUR WEBHOOK ===

    initializeServer() {
        const app = express();
        
        app.use(express.json({ limit: '10mb' }));
        app.use(express.urlencoded({ extended: true }));

        // Middleware de sécurité
        app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });

        // Routes webhook
        app.post('/webhook/:id', this.handleIncomingWebhook.bind(this));
        app.get('/webhook/:id/test', this.testWebhook.bind(this));
        app.get('/webhooks', this.listWebhooks.bind(this));
        app.post('/webhooks', this.createWebhook.bind(this));
        app.delete('/webhook/:id', this.deleteWebhook.bind(this));

        // Routes API
        app.get('/api/status', this.apiStatus.bind(this));
        app.post('/api/obfuscate', this.apiObfuscate.bind(this));
        app.get('/api/stats', this.apiStats.bind(this));
        app.post('/api/notify', this.apiNotify.bind(this));

        // Route de test
        app.get('/health', (req, res) => {
            res.json({ status: 'OK', timestamp: new Date().toISOString() });
        });

        this.server = app.listen(this.port, () => {
            console.log(`🌐 Serveur webhook démarré sur le port ${this.port}`);
        });
    }

    // === GESTION DES WEBHOOKS ===

    async handleIncomingWebhook(req, res) {
        const webhookId = req.params.id;
        const webhook = this.webhooks.get(webhookId);

        if (!webhook) {
            return res.status(404).json({ error: 'Webhook non trouvé' });
        }

        try {
            // Vérifier le rate limiting
            if (!this.checkRateLimit(webhookId, req.ip)) {
                return res.status(429).json({ error: 'Rate limit dépassé' });
            }

            // Vérifier la signature si configurée
            if (webhook.secret && !this.verifySignature(req, webhook.secret)) {
                return res.status(401).json({ error: 'Signature invalide' });
            }

            // Traiter le webhook
            const result = await this.processWebhook(webhookId, req.body, req.headers);
            
            // Enregistrer dans l'historique
            this.addToHistory({
                webhookId,
                timestamp: new Date().toISOString(),
                source: req.ip,
                data: req.body,
                result: result.success,
                error: result.error
            });

            if (result.success) {
                res.json({ success: true, message: 'Webhook traité avec succès' });
            } else {
                res.status(400).json({ error: result.error });
            }

        } catch (error) {
            console.error(`Erreur webhook ${webhookId}:`, error);
            res.status(500).json({ error: 'Erreur interne du serveur' });
        }
    }

    async testWebhook(req, res) {
        const webhookId = req.params.id;
        const webhook = this.webhooks.get(webhookId);

        if (!webhook) {
            return res.status(404).json({ error: 'Webhook non trouvé' });
        }

        try {
            // Envoyer un payload de test
            const testPayload = {
                test: true,
                timestamp: new Date().toISOString(),
                message: 'Test webhook',
                webhookId: webhookId
            };

            const result = await this.processWebhook(webhookId, testPayload, {});
            
            res.json({ 
                success: true, 
                message: 'Test webhook exécuté',
                result: result
            });

        } catch (error) {
            console.error(`Erreur test webhook ${webhookId}:`, error);
            res.status(500).json({ error: 'Erreur lors du test du webhook' });
        }
    }

    async processWebhook(webhookId, data, headers) {
        const webhook = this.webhooks.get(webhookId);
        
        try {
            switch (webhook.type) {
                case 'discord':
                    return await this.processDiscordWebhook(webhook, data);
                
                case 'github':
                    return await this.processGithubWebhook(webhook, data, headers);
                
                case 'payment':
                    return await this.processPaymentWebhook(webhook, data);
                
                case 'monitoring':
                    return await this.processMonitoringWebhook(webhook, data);
                
                case 'notification':
                    return await this.processNotificationWebhook(webhook, data);
                
                case 'custom':
                    return await this.processCustomWebhook(webhook, data);
                
                default:
                    return { success: false, error: 'Type de webhook non supporté' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async processDiscordWebhook(webhook, data) {
        // Traiter les webhooks Discord (interactions, événements, etc.)
        if (data.type === 1) { // PING
            return { success: true, type: 1 };
        }

        if (data.type === 2) { // APPLICATION_COMMAND
            // Traiter une commande slash externe
            return await this.handleExternalCommand(data);
        }

        return { success: true, message: 'Webhook Discord traité' };
    }

    async processGithubWebhook(webhook, data, headers) {
        const event = headers['x-github-event'];
        
        switch (event) {
            case 'push':
                return await this.handleGithubPush(data);
            
            case 'pull_request':
                return await this.handleGithubPR(data);
            
            case 'issues':
                return await this.handleGithubIssue(data);
            
            case 'release':
                return await this.handleGithubRelease(data);
            
            default:
                return { success: true, message: `Événement GitHub ${event} ignoré` };
        }
    }

    async processPaymentWebhook(webhook, data) {
        // Traiter les webhooks de paiement (Stripe, PayPal, etc.)
        const { type, data: paymentData } = data;
        
        switch (type) {
            case 'payment.succeeded':
                return await this.handlePaymentSuccess(paymentData);
            
            case 'payment.failed':
                return await this.handlePaymentFailure(paymentData);
            
            case 'subscription.created':
                return await this.handleSubscriptionCreated(paymentData);
            
            case 'subscription.cancelled':
                return await this.handleSubscriptionCancelled(paymentData);
            
            default:
                return { success: true, message: `Événement paiement ${type} ignoré` };
        }
    }

    async processMonitoringWebhook(webhook, data) {
        // Traiter les webhooks de monitoring (UptimeRobot, Pingdom, etc.)
        const { status, message, url } = data;
        
        if (status === 'down') {
            await this.notifyServiceDown(url, message);
        } else if (status === 'up') {
            await this.notifyServiceUp(url, message);
        }
        
        return { success: true, message: 'Webhook monitoring traité' };
    }

    async processNotificationWebhook(webhook, data) {
        // Traiter les webhooks de notification générique
        await this.sendNotification(webhook.channelId, data.message, data.embed);
        return { success: true, message: 'Notification envoyée' };
    }

    async processCustomWebhook(webhook, data) {
        // Traiter les webhooks personnalisés avec des scripts
        if (webhook.script) {
            try {
                const func = new Function('data', 'webhook', webhook.script);
                const result = await func(data, webhook);
                return { success: true, result };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }
        
        return { success: true, message: 'Webhook personnalisé traité' };
    }

    // === WEBHOOKS SORTANTS ===

    async sendWebhook(url, data, options = {}) {
        const {
            method = 'POST',
            headers = {},
            timeout = 10000,
            retries = 3,
            retryDelay = 1000
        } = options;

        let lastError;
        
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const response = await axios({
                    method,
                    url,
                    data,
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'FSProtect-Bot/1.0',
                        ...headers
                    },
                    timeout
                });

                return {
                    success: true,
                    status: response.status,
                    data: response.data,
                    attempt: attempt + 1
                };

            } catch (error) {
                lastError = error;
                
                if (attempt < retries - 1) {
                    await this.delay(retryDelay * (attempt + 1));
                }
            }
        }

        return {
            success: false,
            error: lastError.message,
            attempts: retries
        };
    }

    async notifyDiscord(webhookUrl, message, embed = null) {
        const payload = {
            content: message,
            username: 'FSProtect Bot',
            avatar_url: 'https://your-avatar-url.com/avatar.png'
        };

        if (embed) {
            payload.embeds = [embed];
        }

        return await this.sendWebhook(webhookUrl, payload);
    }

    async notifySlack(webhookUrl, message, attachments = []) {
        const payload = {
            text: message,
            username: 'FSProtect Bot',
            icon_emoji: ':robot_face:',
            attachments
        };

        return await this.sendWebhook(webhookUrl, payload);
    }

    // === GESTION DES WEBHOOKS ===

    createWebhookEndpoint(type, config = {}) {
        const webhookId = crypto.randomUUID();
        const webhook = {
            id: webhookId,
            type,
            createdAt: new Date().toISOString(),
            secret: crypto.randomBytes(32).toString('hex'),
            active: true,
            ...config
        };

        this.webhooks.set(webhookId, webhook);
        this.saveConfiguration();

        return {
            id: webhookId,
            url: `http://localhost:${this.port}/webhook/${webhookId}`,
            secret: webhook.secret,
            webhook
        };
    }

    updateWebhook(webhookId, updates) {
        const webhook = this.webhooks.get(webhookId);
        if (!webhook) return false;

        Object.assign(webhook, updates, { updatedAt: new Date().toISOString() });
        this.webhooks.set(webhookId, webhook);
        this.saveConfiguration();

        return true;
    }

    deleteWebhookEndpoint(webhookId) {
        const deleted = this.webhooks.delete(webhookId);
        if (deleted) {
            this.saveConfiguration();
        }
        return deleted;
    }

    // === GESTIONNAIRES D'ÉVÉNEMENTS ===

    async handleGithubPush(data) {
        const { repository, pusher, commits } = data;
        
        const embed = {
            title: '📝 Nouveau push sur GitHub',
            description: `${commits.length} commit(s) sur ${repository.full_name}`,
            color: 0x2ecc71,
            fields: [
                {
                    name: 'Auteur',
                    value: pusher.name,
                    inline: true
                },
                {
                    name: 'Branche',
                    value: data.ref.replace('refs/heads/', ''),
                    inline: true
                },
                {
                    name: 'Commits',
                    value: commits.slice(0, 3).map(c => `• \`${c.id.slice(0, 7)}\` ${c.message}`).join('\n'),
                    inline: false
                }
            ],
            timestamp: new Date().toISOString()
        };

        await this.broadcastToChannels('github-updates', null, embed);
        return { success: true };
    }

    async handlePaymentSuccess(data) {
        const { customer, amount, currency, product } = data;
        
        const embed = {
            title: '💰 Paiement reçu',
            description: `Nouveau paiement de ${amount/100} ${currency.toUpperCase()}`,
            color: 0x27ae60,
            fields: [
                {
                    name: 'Client',
                    value: customer.email || customer.id,
                    inline: true
                },
                {
                    name: 'Produit',
                    value: product || 'Service premium',
                    inline: true
                },
                {
                    name: 'Montant',
                    value: `${amount/100} ${currency.toUpperCase()}`,
                    inline: true
                }
            ],
            timestamp: new Date().toISOString()
        };

        await this.broadcastToChannels('payments', null, embed);
        return { success: true };
    }

    async notifyServiceDown(url, message) {
        const embed = {
            title: '🚨 Service indisponible',
            description: `Le service ${url} est actuellement indisponible`,
            color: 0xe74c3c,
            fields: [
                {
                    name: 'URL',
                    value: url,
                    inline: true
                },
                {
                    name: 'Message',
                    value: message || 'Aucun détail',
                    inline: false
                }
            ],
            timestamp: new Date().toISOString()
        };

        await this.broadcastToChannels('monitoring', '⚠️ Alerte service', embed);
    }

    // === API ENDPOINTS ===

    async apiStatus(req, res) {
        if (!this.verifyApiKey(req)) {
            return res.status(401).json({ error: 'Clé API invalide' });
        }

        res.json({
            status: 'online',
            uptime: process.uptime(),
            webhooks: this.webhooks.size,
            version: '1.0.0',
            timestamp: new Date().toISOString()
        });
    }

    async apiObfuscate(req, res) {
        if (!this.verifyApiKey(req)) {
            return res.status(401).json({ error: 'Clé API invalide' });
        }

        try {
            const { code, options = {} } = req.body;
            
            if (!code) {
                return res.status(400).json({ error: 'Code requis' });
            }

            // Utiliser le système d'obfuscation existant
            const obfuscator = require('./obfuscator');
            const result = await obfuscator.obfusquer(code, options);

            res.json({
                success: true,
                obfuscatedCode: result.code,
                statistics: result.stats
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async apiStats(req, res) {
        if (!this.verifyApiKey(req)) {
            return res.status(401).json({ error: 'Clé API invalide' });
        }

        const stats = {
            webhooks: {
                total: this.webhooks.size,
                active: Array.from(this.webhooks.values()).filter(w => w.active).length,
                byType: this.getWebhookStatsByType()
            },
            requests: {
                total: this.webhookHistory.length,
                lastHour: this.getRequestsLastHour(),
                successRate: this.getSuccessRate()
            },
            rateLimits: {
                active: this.rateLimits.size,
                topSources: this.getTopRateLimitedSources()
            }
        };

        res.json(stats);
    }

    async apiNotify(req, res) {
        if (!this.verifyApiKey(req)) {
            return res.status(401).json({ error: 'Clé API invalide' });
        }

        try {
            const { channel, message, embed } = req.body;
            
            await this.sendNotification(channel, message, embed);
            
            res.json({ success: true, message: 'Notification envoyée' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // === SÉCURITÉ ===

    verifySignature(req, secret) {
        const signature = req.headers['x-hub-signature-256'];
        if (!signature) return false;

        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(req.body))
            .digest('hex');

        return signature === `sha256=${expectedSignature}`;
    }

    verifyApiKey(req) {
        const apiKey = req.headers['x-api-key'] || req.query.api_key;
        
        if (!apiKey) return false;
        
        for (const [key, data] of this.apiKeys) {
            if (key === apiKey && data.active) {
                // Incrémenter le compteur d'utilisation
                data.usageCount = (data.usageCount || 0) + 1;
                data.lastUsed = new Date().toISOString();
                return true;
            }
        }
        
        return false;
    }

    generateApiKey(name, permissions = []) {
        const apiKey = crypto.randomBytes(32).toString('hex');
        const keyData = {
            name,
            permissions,
            createdAt: new Date().toISOString(),
            active: true,
            usageCount: 0,
            lastUsed: null
        };

        this.apiKeys.set(apiKey, keyData);
        this.saveConfiguration();

        return { apiKey, ...keyData };
    }

    revokeApiKey(apiKey) {
        const keyData = this.apiKeys.get(apiKey);
        if (keyData) {
            keyData.active = false;
            keyData.revokedAt = new Date().toISOString();
            this.saveConfiguration();
            return true;
        }
        return false;
    }

    // === RATE LIMITING ===

    checkRateLimit(identifier, ip) {
        const key = `${identifier}_${ip}`;
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute
        const maxRequests = 100; // 100 requêtes par minute

        const limit = this.rateLimits.get(key) || { count: 0, resetTime: now + windowMs };

        if (now > limit.resetTime) {
            limit.count = 0;
            limit.resetTime = now + windowMs;
        }

        limit.count++;
        this.rateLimits.set(key, limit);

        return limit.count <= maxRequests;
    }

    // === UTILITAIRES ===

    setupDefaultWebhooks() {
        // Webhook pour les notifications système
        if (!Array.from(this.webhooks.values()).find(w => w.type === 'system')) {
            this.createWebhookEndpoint('notification', {
                name: 'Notifications Système',
                channelId: process.env.SYSTEM_CHANNEL_ID,
                description: 'Webhook pour les notifications système'
            });
        }
    }

    addToHistory(entry) {
        this.webhookHistory.push(entry);
        
        // Garder seulement les 1000 dernières entrées
        if (this.webhookHistory.length > 1000) {
            this.webhookHistory = this.webhookHistory.slice(-1000);
        }
    }

    async broadcastToChannels(category, message, embed) {
        // Implémenter la diffusion vers les canaux Discord appropriés
        console.log(`Broadcasting to ${category}:`, message, embed);
    }

    async sendNotification(channelId, message, embed) {
        // Implémenter l'envoi de notification Discord
        console.log(`Notification to ${channelId}:`, message, embed);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getWebhookStatsByType() {
        const stats = {};
        for (const webhook of this.webhooks.values()) {
            stats[webhook.type] = (stats[webhook.type] || 0) + 1;
        }
        return stats;
    }

    getRequestsLastHour() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return this.webhookHistory.filter(entry => 
            new Date(entry.timestamp) > oneHourAgo
        ).length;
    }

    getSuccessRate() {
        if (this.webhookHistory.length === 0) return 100;
        
        const successful = this.webhookHistory.filter(entry => entry.result).length;
        return ((successful / this.webhookHistory.length) * 100).toFixed(2);
    }

    getTopRateLimitedSources() {
        const sources = {};
        for (const [key] of this.rateLimits) {
            const ip = key.split('_').pop();
            sources[ip] = (sources[ip] || 0) + 1;
        }
        return Object.entries(sources)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .reduce((obj, [ip, count]) => {
                obj[ip] = count;
                return obj;
            }, {});
    }

    // === MÉTHODES API ===

    async listWebhooks(req, res) {
        try {
            const webhooksList = Array.from(this.webhooks.entries()).map(([id, webhook]) => ({
                id,
                type: webhook.type,
                url: `${req.protocol}://${req.get('host')}/webhook/${id}`,
                description: webhook.description || '',
                created: webhook.created || new Date().toISOString(),
                enabled: webhook.enabled !== false
            }));

            res.json({
                success: true,
                webhooks: webhooksList,
                total: webhooksList.length
            });
        } catch (error) {
            console.error('Erreur listWebhooks:', error);
            res.status(500).json({ error: 'Erreur interne du serveur' });
        }
    }

    async createWebhook(req, res) {
        try {
            const { type, description, config = {} } = req.body;

            if (!type) {
                return res.status(400).json({ error: 'Type de webhook requis' });
            }

            const webhookId = this.createWebhookEndpoint(type, {
                description,
                ...config
            });

            const webhook = this.webhooks.get(webhookId);
            
            res.json({
                success: true,
                webhook: {
                    id: webhookId,
                    type: webhook.type,
                    url: `${req.protocol}://${req.get('host')}/webhook/${webhookId}`,
                    description: webhook.description || '',
                    created: webhook.created || new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Erreur createWebhook:', error);
            res.status(500).json({ error: 'Erreur lors de la création du webhook' });
        }
    }

    async deleteWebhook(req, res) {
        try {
            const webhookId = req.params.id;

            if (!this.webhooks.has(webhookId)) {
                return res.status(404).json({ error: 'Webhook non trouvé' });
            }

            this.webhooks.delete(webhookId);
            this.saveConfiguration();

            res.json({
                success: true,
                message: 'Webhook supprimé avec succès'
            });

        } catch (error) {
            console.error('Erreur deleteWebhook:', error);
            res.status(500).json({ error: 'Erreur lors de la suppression du webhook' });
        }
    }

    // === FERMETURE PROPRE ===

    close() {
        if (this.server) {
            this.server.close();
            console.log('🔌 Serveur webhook fermé');
        }
        this.saveConfiguration();
    }
}

module.exports = WebhookSystem;
