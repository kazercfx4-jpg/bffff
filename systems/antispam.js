const { Collection, EmbedBuilder } = require('discord.js');

class AntiSpam {
    constructor() {
        this.userMessages = new Collection();
        this.userWarnings = new Collection();
        this.rateLimits = new Collection();
        this.mutedUsers = new Collection();
        this.autoModLog = [];
        
        // Configuration
        this.config = {
            enabled: true,
            maxMessages: 5,
            timeWindow: 10000, // 10 secondes
            warningThreshold: 3,
            muteTime: 300000, // 5 minutes
            
            // Anti-liens
            antiLink: {
                enabled: true,
                allowedDomains: ['discord.gg', 'github.com', 'docs.fivem.net'],
                blockedDomains: ['bit.ly', 'tinyurl.com'],
                whitelistedChannels: []
            },
            
            // Auto-modération
            autoMod: {
                enabled: true,
                filterProfanity: true,
                filterInvites: true,
                filterMentionSpam: true,
                maxMentions: 5,
                filterCapsSpam: true,
                capsThreshold: 0.7,
                filterRepeatedChars: true,
                filterZalgo: true
            },
            
            // Patterns de détection
            patterns: {
                inviteRegex: /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/.+/gi,
                linkRegex: /(https?:\/\/[^\s]+)/gi,
                mentionRegex: /<@[!&]?\d+>/g,
                emojiSpamRegex: /(.)\1{4,}/g,
                zalgoRegex: /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g
            },
            
            // Mots bannis (exemple)
            bannedWords: [
                'spam', 'hack', 'exploit', 'cheat', 'bypass',
                'cracked', 'leaked', 'free', 'discord.gg',
                'nitro', 'gift', 'giveaway'
            ]
        };
    }

    async initialize() {
        console.log('🛡️ Système anti-spam initialisé');
        
        // Nettoyer les anciens messages toutes les minutes
        setInterval(() => {
            this.cleanupOldMessages();
        }, 60000);
        
        // Nettoyer les mutes expirés
        setInterval(() => {
            this.cleanupExpiredMutes();
        }, 30000);
    }

    // ===============================
    // DÉTECTION DE SPAM
    // ===============================

    isSpamming(userId) {
        if (!this.config.enabled) return false;

        const now = Date.now();
        const userRateLimit = this.rateLimits.get(userId);

        if (!userRateLimit) {
            this.rateLimits.set(userId, {
                count: 1,
                resetTime: now + this.config.timeWindow
            });
            return false;
        }

        if (now > userRateLimit.resetTime) {
            // Reset du compteur
            userRateLimit.count = 1;
            userRateLimit.resetTime = now + this.config.timeWindow;
            return false;
        }

        userRateLimit.count++;
        return userRateLimit.count > this.config.maxMessages;
    }

    checkMessage(message) {
        if (message.author.bot || !this.config.enabled) return false;

        const userId = message.author.id;
        const now = Date.now();

        // Vérifier si l'utilisateur est mute
        if (this.mutedUsers.has(userId)) {
            const muteData = this.mutedUsers.get(userId);
            if (now < muteData.until) {
                message.delete().catch(() => {});
                return true;
            } else {
                this.mutedUsers.delete(userId);
            }
        }

        // Historique des messages de l'utilisateur
        let userHistory = this.userMessages.get(userId);
        if (!userHistory) {
            userHistory = [];
            this.userMessages.set(userId, userHistory);
        }

        // Ajouter le message actuel
        userHistory.push({
            content: message.content,
            timestamp: now,
            channelId: message.channel.id
        });

        // Garder seulement les messages récents
        userHistory = userHistory.filter(msg => now - msg.timestamp < this.config.timeWindow);
        this.userMessages.set(userId, userHistory);

        // Vérifier le spam
        const recentMessages = userHistory.length;
        const duplicateMessages = this.countDuplicateMessages(userHistory);
        const rapidMessages = this.countRapidMessages(userHistory);

        if (recentMessages > this.config.maxMessages || duplicateMessages > 3 || rapidMessages > 5) {
            return true;
        }

        return false;
    }

    async handleSpam(message) {
        const userId = message.author.id;
        const guildId = message.guild.id;

        // Supprimer le message
        try {
            await message.delete();
        } catch (error) {
            console.error('Erreur suppression message spam:', error);
        }

        // Incrémenter les avertissements
        let warnings = this.userWarnings.get(userId) || 0;
        warnings++;
        this.userWarnings.set(userId, warnings);

        // Actions selon le nombre d'avertissements
        if (warnings >= this.config.warningThreshold) {
            await this.muteUser(message.member, this.config.muteTime, 'Spam répété');
            this.userWarnings.delete(userId);
        } else {
            // Envoyer un avertissement
            const warningEmbed = new EmbedBuilder()
                .setTitle('⚠️ Avertissement Anti-Spam')
                .setDescription(`${message.author}, ralentissez vos messages. Avertissement ${warnings}/${this.config.warningThreshold}`)
                .setColor(0xff9900)
                .setTimestamp();

            const warningMsg = await message.channel.send({ embeds: [warningEmbed] });
            
            // Supprimer l'avertissement après 5 secondes
            setTimeout(() => {
                warningMsg.delete().catch(() => {});
            }, 5000);
        }

        // Log de l'action
        this.logAction('SPAM_DETECTED', userId, {
            messageContent: message.content.substring(0, 100),
            warnings: warnings,
            channelId: message.channel.id
        });
    }

    // ===============================
    // ANTI-LIENS
    // ===============================

    checkLinks(message) {
        if (!this.config.antiLink.enabled || message.author.bot) return false;

        const content = message.content.toLowerCase();
        const links = content.match(this.config.patterns.linkRegex);

        if (!links) return false;

        // Vérifier si le canal est whitelisté
        if (this.config.antiLink.whitelistedChannels.includes(message.channel.id)) {
            return false;
        }

        // Vérifier les domaines
        for (const link of links) {
            const domain = this.extractDomain(link);
            
            // Domaines bloqués
            if (this.config.antiLink.blockedDomains.some(blocked => domain.includes(blocked))) {
                return true;
            }
            
            // Domaines non autorisés (si liste blanche active)
            if (this.config.antiLink.allowedDomains.length > 0) {
                if (!this.config.antiLink.allowedDomains.some(allowed => domain.includes(allowed))) {
                    return true;
                }
            }
        }

        return false;
    }

    async handleLinks(message) {
        try {
            await message.delete();
            
            const warningEmbed = new EmbedBuilder()
                .setTitle('🚫 Lien Non Autorisé')
                .setDescription(`${message.author}, les liens ne sont pas autorisés dans ce canal.`)
                .setColor(0xff0000)
                .setTimestamp();

            const warningMsg = await message.channel.send({ embeds: [warningEmbed] });
            
            setTimeout(() => {
                warningMsg.delete().catch(() => {});
            }, 5000);

            this.logAction('LINK_BLOCKED', message.author.id, {
                messageContent: message.content,
                channelId: message.channel.id
            });
        } catch (error) {
            console.error('Erreur gestion lien:', error);
        }
    }

    // ===============================
    // AUTO-MODÉRATION
    // ===============================

    checkAutoMod(message) {
        if (!this.config.autoMod.enabled || message.author.bot) return false;

        const content = message.content;
        const violations = [];

        // Vérifier les invitations Discord
        if (this.config.autoMod.filterInvites && this.config.patterns.inviteRegex.test(content)) {
            violations.push('discord_invite');
        }

        // Vérifier le spam de mentions
        if (this.config.autoMod.filterMentionSpam) {
            const mentions = content.match(this.config.patterns.mentionRegex);
            if (mentions && mentions.length > this.config.autoMod.maxMentions) {
                violations.push('mention_spam');
            }
        }

        // Vérifier le spam de majuscules
        if (this.config.autoMod.filterCapsSpam) {
            const capsRatio = this.calculateCapsRatio(content);
            if (capsRatio > this.config.autoMod.capsThreshold && content.length > 10) {
                violations.push('caps_spam');
            }
        }

        // Vérifier les caractères répétés
        if (this.config.autoMod.filterRepeatedChars && this.config.patterns.emojiSpamRegex.test(content)) {
            violations.push('repeated_chars');
        }

        // Vérifier le texte Zalgo
        if (this.config.autoMod.filterZalgo && this.config.patterns.zalgoRegex.test(content)) {
            violations.push('zalgo_text');
        }

        // Vérifier les mots bannis
        if (this.config.autoMod.filterProfanity) {
            const words = content.toLowerCase().split(/\s+/);
            for (const word of words) {
                if (this.config.bannedWords.includes(word)) {
                    violations.push('banned_word');
                    break;
                }
            }
        }

        return violations.length > 0 ? violations : false;
    }

    async handleAutoMod(message, violations) {
        try {
            await message.delete();
            
            const violationTypes = {
                'discord_invite': 'Invitation Discord non autorisée',
                'mention_spam': 'Spam de mentions',
                'caps_spam': 'Abus de majuscules',
                'repeated_chars': 'Caractères répétés',
                'zalgo_text': 'Texte corrompu',
                'banned_word': 'Mot interdit'
            };

            const violationText = violations.map(v => violationTypes[v] || v).join(', ');

            const warningEmbed = new EmbedBuilder()
                .setTitle('🛡️ Auto-Modération')
                .setDescription(`${message.author}, votre message a été supprimé.\nRaison: ${violationText}`)
                .setColor(0xff6600)
                .setTimestamp();

            const warningMsg = await message.channel.send({ embeds: [warningEmbed] });
            
            setTimeout(() => {
                warningMsg.delete().catch(() => {});
            }, 7000);

            // Incrémenter les infractions
            const userId = message.author.id;
            let infractions = this.userWarnings.get(`automod_${userId}`) || 0;
            infractions++;
            this.userWarnings.set(`automod_${userId}`, infractions);

            // Mute si trop d'infractions
            if (infractions >= 3) {
                await this.muteUser(message.member, this.config.muteTime * 2, 'Multiples violations auto-mod');
                this.userWarnings.delete(`automod_${userId}`);
            }

            this.logAction('AUTOMOD_VIOLATION', userId, {
                violations: violations,
                messageContent: message.content.substring(0, 100),
                infractions: infractions
            });
        } catch (error) {
            console.error('Erreur auto-modération:', error);
        }
    }

    // ===============================
    // GESTION DES MUTES
    // ===============================

    async muteUser(member, duration, reason) {
        const userId = member.id;
        const until = Date.now() + duration;

        this.mutedUsers.set(userId, {
            until: until,
            reason: reason,
            mutedAt: Date.now()
        });

        // Essayer de timeout l'utilisateur (si permissions)
        try {
            await member.timeout(duration, reason);
        } catch (error) {
            console.error('Erreur timeout utilisateur:', error);
        }

        // Log de mute
        const muteEmbed = new EmbedBuilder()
            .setTitle('🔇 Utilisateur Mute')
            .setDescription(`${member.user.tag} a été mute pour ${this.formatDuration(duration)}`)
            .addFields(
                { name: 'Raison', value: reason, inline: true },
                { name: 'Durée', value: this.formatDuration(duration), inline: true }
            )
            .setColor(0xff0000)
            .setTimestamp();

        // Envoyer dans le canal de logs si configuré
        const logChannelId = this.getLogChannelId(member.guild.id);
        if (logChannelId) {
            const logChannel = member.guild.channels.cache.get(logChannelId);
            if (logChannel) {
                await logChannel.send({ embeds: [muteEmbed] });
            }
        }

        this.logAction('USER_MUTED', userId, { duration, reason });
    }

    async unmuteUser(userId) {
        if (this.mutedUsers.has(userId)) {
            this.mutedUsers.delete(userId);
            this.logAction('USER_UNMUTED', userId);
            return true;
        }
        return false;
    }

    // ===============================
    // UTILITAIRES
    // ===============================

    countDuplicateMessages(messages) {
        const contentMap = new Map();
        let maxDuplicates = 0;

        for (const msg of messages) {
            const count = contentMap.get(msg.content) || 0;
            contentMap.set(msg.content, count + 1);
            maxDuplicates = Math.max(maxDuplicates, count + 1);
        }

        return maxDuplicates;
    }

    countRapidMessages(messages) {
        if (messages.length < 2) return 0;

        let rapidCount = 0;
        for (let i = 1; i < messages.length; i++) {
            if (messages[i].timestamp - messages[i-1].timestamp < 2000) { // 2 secondes
                rapidCount++;
            }
        }

        return rapidCount;
    }

    calculateCapsRatio(text) {
        const letters = text.replace(/[^a-zA-Z]/g, '');
        if (letters.length === 0) return 0;
        
        const caps = text.replace(/[^A-Z]/g, '');
        return caps.length / letters.length;
    }

    extractDomain(url) {
        try {
            const urlObj = new URL(url.startsWith('http') ? url : 'http://' + url);
            return urlObj.hostname.toLowerCase();
        } catch {
            return url.toLowerCase();
        }
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    cleanupOldMessages() {
        const now = Date.now();
        const cutoff = now - (this.config.timeWindow * 2);

        for (const [userId, messages] of this.userMessages) {
            const filteredMessages = messages.filter(msg => msg.timestamp > cutoff);
            if (filteredMessages.length === 0) {
                this.userMessages.delete(userId);
            } else {
                this.userMessages.set(userId, filteredMessages);
            }
        }

        // Nettoyer les rate limits expirés
        for (const [userId, rateLimit] of this.rateLimits) {
            if (now > rateLimit.resetTime) {
                this.rateLimits.delete(userId);
            }
        }
    }

    cleanupExpiredMutes() {
        const now = Date.now();
        
        for (const [userId, muteData] of this.mutedUsers) {
            if (now > muteData.until) {
                this.mutedUsers.delete(userId);
                this.logAction('MUTE_EXPIRED', userId);
            }
        }
    }

    logAction(action, userId, metadata = {}) {
        const entry = {
            timestamp: new Date(),
            action: action,
            userId: userId,
            metadata: metadata
        };

        this.autoModLog.push(entry);
        
        // Garder seulement les 500 dernières entrées
        if (this.autoModLog.length > 500) {
            this.autoModLog = this.autoModLog.slice(-500);
        }
    }

    getLogChannelId(guildId) {
        // TODO: Récupérer depuis la config du serveur
        return null;
    }

    // ===============================
    // CONFIGURATION
    // ===============================

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    getConfig() {
        return this.config;
    }

    getStats() {
        return {
            totalMessages: this.autoModLog.length,
            activeUsers: this.userMessages.size,
            mutedUsers: this.mutedUsers.size,
            rateLimitedUsers: this.rateLimits.size,
            recentActions: this.autoModLog.slice(-10)
        };
    }

    isUserMuted(userId) {
        if (!this.mutedUsers.has(userId)) return false;
        
        const muteData = this.mutedUsers.get(userId);
        if (Date.now() > muteData.until) {
            this.mutedUsers.delete(userId);
            return false;
        }
        
        return true;
    }

    getMuteInfo(userId) {
        return this.mutedUsers.get(userId) || null;
    }
}

module.exports = AntiSpam;