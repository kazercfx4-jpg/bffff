const { EmbedBuilder, WebhookClient } = require('discord.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class NotificationSystem {
    constructor(languageManager) {
        this.lang = languageManager;
        this.webhooks = new Map();
        this.subscriptions = new Map();
        this.notificationQueue = [];
        this.templates = new Map();
        this.loadConfiguration();
        this.initializeTemplates();
        this.startQueueProcessor();
    }

    loadConfiguration() {
        try {
            const configPath = path.join(__dirname, '..', 'data', 'notifications.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                this.webhooks = new Map(config.webhooks || []);
                this.subscriptions = new Map(config.subscriptions || []);
            }
        } catch (error) {
            console.error('Erreur chargement config notifications:', error);
        }
    }

    saveConfiguration() {
        try {
            const configPath = path.join(__dirname, '..', 'data', 'notifications.json');
            const config = {
                webhooks: Array.from(this.webhooks.entries()),
                subscriptions: Array.from(this.subscriptions.entries())
            };
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('Erreur sauvegarde config notifications:', error);
        }
    }

    initializeTemplates() {
        // Template pour maintenance
        this.templates.set('maintenance', {
            title: '🚧 Maintenance Programmée',
            color: '#ff9900',
            fields: [
                { name: 'Début', value: '{startTime}', inline: true },
                { name: 'Fin estimée', value: '{endTime}', inline: true },
                { name: 'Raison', value: '{reason}', inline: false },
                { name: 'Impact', value: '{impact}', inline: false }
            ],
            footer: 'Merci de votre patience'
        });

        // Template pour nouvelles fonctionnalités
        this.templates.set('feature', {
            title: '🆕 Nouvelle Fonctionnalité',
            color: '#00ff88',
            fields: [
                { name: 'Fonctionnalité', value: '{feature}', inline: false },
                { name: 'Description', value: '{description}', inline: false },
                { name: 'Comment l\'utiliser', value: '{usage}', inline: false },
                { name: 'Disponible pour', value: '{plans}', inline: true }
            ],
            footer: 'FSProtect - Toujours plus d\'innovations'
        });

        // Template pour alertes sécurité
        this.templates.set('security', {
            title: '🚨 Alerte Sécurité',
            color: '#ff0000',
            fields: [
                { name: 'Type d\'incident', value: '{type}', inline: true },
                { name: 'Gravité', value: '{severity}', inline: true },
                { name: 'Actions requises', value: '{actions}', inline: false },
                { name: 'Plus d\'informations', value: '{details}', inline: false }
            ],
            footer: 'Sécurité FSProtect'
        });

        // Template pour mises à jour
        this.templates.set('update', {
            title: '📦 Mise à Jour Disponible',
            color: '#3498db',
            fields: [
                { name: 'Version', value: '{version}', inline: true },
                { name: 'Taille', value: '{size}', inline: true },
                { name: 'Nouveautés', value: '{changelog}', inline: false },
                { name: 'Corrections', value: '{bugfixes}', inline: false },
                { name: 'Installation', value: '{instructions}', inline: false }
            ],
            footer: 'Mise à jour automatique recommandée'
        });

        // Template pour événements
        this.templates.set('event', {
            title: '🎉 Événement Spécial',
            color: '#9932cc',
            fields: [
                { name: 'Événement', value: '{event}', inline: false },
                { name: 'Date', value: '{date}', inline: true },
                { name: 'Durée', value: '{duration}', inline: true },
                { name: 'Récompenses', value: '{rewards}', inline: false },
                { name: 'Participation', value: '{participation}', inline: false }
            ],
            footer: 'Ne ratez pas cette opportunité !'
        });

        // Template pour promotions
        this.templates.set('promotion', {
            title: '💎 Offre Spéciale',
            color: '#f39c12',
            fields: [
                { name: 'Offre', value: '{offer}', inline: false },
                { name: 'Réduction', value: '{discount}', inline: true },
                { name: 'Valable jusqu\'au', value: '{expires}', inline: true },
                { name: 'Code promo', value: '{code}', inline: false },
                { name: 'Conditions', value: '{terms}', inline: false }
            ],
            footer: 'Offre limitée dans le temps'
        });
    }

    startQueueProcessor() {
        // Traiter la queue toutes les 5 secondes
        setInterval(() => {
            this.processNotificationQueue();
        }, 5000);
    }

    async processNotificationQueue() {
        if (this.notificationQueue.length === 0) return;

        const batch = this.notificationQueue.splice(0, 10); // Traiter 10 notifications max par batch
        
        for (const notification of batch) {
            try {
                await this.sendNotification(notification);
            } catch (error) {
                console.error('Erreur envoi notification:', error);
                // Remettre en queue si erreur temporaire
                if (notification.retries < 3) {
                    notification.retries = (notification.retries || 0) + 1;
                    this.notificationQueue.push(notification);
                }
            }
        }
    }

    async sendNotification(notification) {
        const { type, channels, data, options = {} } = notification;

        // Créer l'embed à partir du template
        const embed = this.createEmbedFromTemplate(type, data);
        
        // Envoyer vers tous les canaux abonnés
        for (const channelId of channels) {
            const channel = await this.getNotificationChannel(channelId);
            if (channel) {
                await this.sendToChannel(channel, embed, options);
            }
        }

        // Envoyer vers les webhooks configurés
        await this.sendToWebhooks(type, embed, options);
    }

    createEmbedFromTemplate(type, data) {
        const template = this.templates.get(type);
        if (!template) {
            throw new Error(`Template non trouvé pour le type: ${type}`);
        }

        const embed = new EmbedBuilder()
            .setTitle(this.replaceVariables(template.title, data))
            .setColor(template.color)
            .setTimestamp();

        // Ajouter les champs
        for (const field of template.fields) {
            const name = this.replaceVariables(field.name, data);
            const value = this.replaceVariables(field.value, data);
            
            if (value && value !== 'undefined' && value !== 'null') {
                embed.addFields({ 
                    name, 
                    value: value.length > 1024 ? value.substring(0, 1021) + '...' : value, 
                    inline: field.inline || false 
                });
            }
        }

        if (template.footer) {
            embed.setFooter({ text: this.replaceVariables(template.footer, data) });
        }

        if (data.thumbnail) {
            embed.setThumbnail(data.thumbnail);
        }

        if (data.image) {
            embed.setImage(data.image);
        }

        return embed;
    }

    replaceVariables(text, data) {
        return text.replace(/\{(\w+)\}/g, (match, key) => {
            return data[key] || match;
        });
    }

    async getNotificationChannel(channelId) {
        try {
            // Logique pour récupérer le canal Discord
            // Nécessite une référence au client Discord
            return null; // Placeholder
        } catch (error) {
            console.error(`Erreur récupération canal ${channelId}:`, error);
            return null;
        }
    }

    async sendToChannel(channel, embed, options) {
        try {
            const message = { embeds: [embed] };
            
            if (options.mention) {
                message.content = options.mention;
            }

            if (options.components) {
                message.components = options.components;
            }

            await channel.send(message);
        } catch (error) {
            console.error('Erreur envoi vers canal:', error);
        }
    }

    async sendToWebhooks(type, embed, options) {
        for (const [webhookId, webhookData] of this.webhooks) {
            if (webhookData.types.includes(type) || webhookData.types.includes('all')) {
                try {
                    const webhook = new WebhookClient({ url: webhookData.url });
                    
                    await webhook.send({
                        username: 'FSProtect Notifications',
                        avatarURL: 'https://fsprotect.fr/logo.png',
                        embeds: [embed]
                    });
                } catch (error) {
                    console.error(`Erreur webhook ${webhookId}:`, error);
                }
            }
        }
    }

    // === MÉTHODES PUBLIQUES ===

    queueNotification(type, data, targetChannels = [], options = {}) {
        const notification = {
            id: crypto.randomBytes(16).toString('hex'),
            type,
            data,
            channels: targetChannels,
            options,
            timestamp: Date.now(),
            retries: 0
        };

        this.notificationQueue.push(notification);
        return notification.id;
    }

    scheduleNotification(type, data, targetChannels = [], sendAt, options = {}) {
        const delay = sendAt - Date.now();
        if (delay <= 0) {
            return this.queueNotification(type, data, targetChannels, options);
        }

        setTimeout(() => {
            this.queueNotification(type, data, targetChannels, options);
        }, delay);

        return `scheduled_${Date.now()}`;
    }

    subscribeChannel(channelId, types = ['all']) {
        const subscription = this.subscriptions.get(channelId) || { types: [], settings: {} };
        
        for (const type of types) {
            if (!subscription.types.includes(type)) {
                subscription.types.push(type);
            }
        }

        this.subscriptions.set(channelId, subscription);
        this.saveConfiguration();
    }

    unsubscribeChannel(channelId, types = null) {
        const subscription = this.subscriptions.get(channelId);
        if (!subscription) return false;

        if (types === null) {
            this.subscriptions.delete(channelId);
        } else {
            subscription.types = subscription.types.filter(t => !types.includes(t));
            if (subscription.types.length === 0) {
                this.subscriptions.delete(channelId);
            } else {
                this.subscriptions.set(channelId, subscription);
            }
        }

        this.saveConfiguration();
        return true;
    }

    addWebhook(url, types = ['all'], name = null) {
        const webhookId = crypto.randomBytes(8).toString('hex');
        
        this.webhooks.set(webhookId, {
            url,
            types,
            name: name || `Webhook ${webhookId}`,
            created: Date.now(),
            lastUsed: null,
            messagesSent: 0
        });

        this.saveConfiguration();
        return webhookId;
    }

    removeWebhook(webhookId) {
        const removed = this.webhooks.delete(webhookId);
        if (removed) {
            this.saveConfiguration();
        }
        return removed;
    }

    getWebhooks() {
        return Array.from(this.webhooks.entries()).map(([id, data]) => ({
            id,
            ...data
        }));
    }

    getSubscriptions() {
        return Array.from(this.subscriptions.entries()).map(([channelId, data]) => ({
            channelId,
            ...data
        }));
    }

    // === NOTIFICATIONS PRÉDÉFINIES ===

    async notifyMaintenance(startTime, endTime, reason, impact = 'Fonctionnalités limitées') {
        const data = {
            startTime: new Date(startTime).toLocaleString(),
            endTime: new Date(endTime).toLocaleString(),
            reason,
            impact
        };

        const channels = this.getChannelsForType('maintenance');
        return this.queueNotification('maintenance', data, channels, {
            mention: '@everyone'
        });
    }

    async notifyNewFeature(feature, description, usage, plans = 'Tous les plans') {
        const data = {
            feature,
            description,
            usage,
            plans
        };

        const channels = this.getChannelsForType('feature');
        return this.queueNotification('feature', data, channels);
    }

    async notifySecurityAlert(type, severity, actions, details) {
        const data = {
            type,
            severity,
            actions,
            details
        };

        const channels = this.getChannelsForType('security');
        return this.queueNotification('security', data, channels, {
            mention: '@here'
        });
    }

    async notifyUpdate(version, size, changelog, bugfixes, instructions) {
        const data = {
            version,
            size,
            changelog,
            bugfixes,
            instructions
        };

        const channels = this.getChannelsForType('update');
        return this.queueNotification('update', data, channels);
    }

    async notifyEvent(event, date, duration, rewards, participation) {
        const data = {
            event,
            date,
            duration,
            rewards,
            participation
        };

        const channels = this.getChannelsForType('event');
        return this.queueNotification('event', data, channels);
    }

    async notifyPromotion(offer, discount, expires, code, terms) {
        const data = {
            offer,
            discount,
            expires,
            code,
            terms
        };

        const channels = this.getChannelsForType('promotion');
        return this.queueNotification('promotion', data, channels);
    }

    getChannelsForType(type) {
        const channels = [];
        
        for (const [channelId, subscription] of this.subscriptions) {
            if (subscription.types.includes(type) || subscription.types.includes('all')) {
                channels.push(channelId);
            }
        }

        return channels;
    }

    // === STATISTIQUES ===

    getNotificationStats() {
        const stats = {
            queueSize: this.notificationQueue.length,
            totalWebhooks: this.webhooks.size,
            totalSubscriptions: this.subscriptions.size,
            typeBreakdown: {},
            webhookStats: {}
        };

        // Statistiques par type
        for (const [channelId, subscription] of this.subscriptions) {
            for (const type of subscription.types) {
                stats.typeBreakdown[type] = (stats.typeBreakdown[type] || 0) + 1;
            }
        }

        // Statistiques webhooks
        for (const [id, webhook] of this.webhooks) {
            stats.webhookStats[id] = {
                name: webhook.name,
                messagesSent: webhook.messagesSent,
                lastUsed: webhook.lastUsed,
                types: webhook.types
            };
        }

        return stats;
    }

    // === GESTION DES TEMPLATES ===

    addCustomTemplate(type, template) {
        this.templates.set(type, template);
    }

    getTemplate(type) {
        return this.templates.get(type);
    }

    getAllTemplates() {
        return Array.from(this.templates.entries()).map(([type, template]) => ({
            type,
            ...template
        }));
    }

    // === TESTS ===

    async testNotification(type, channelId) {
        const testData = {
            feature: 'Test Feature',
            description: 'Ceci est un test de notification',
            usage: 'Pour tester le système',
            plans: 'Test',
            startTime: new Date().toLocaleString(),
            endTime: new Date(Date.now() + 3600000).toLocaleString(),
            reason: 'Test de notification',
            impact: 'Aucun impact'
        };

        return this.queueNotification(type, testData, [channelId], {
            mention: '🧪 **TEST** - '
        });
    }
}

module.exports = NotificationSystem;
