const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

class AdvancedModeration {
    constructor(languageManager) {
        this.lang = languageManager;
        this.moderationLogs = new Map();
        this.userWarnings = new Map();
        this.tempBans = new Map();
        this.autoModRules = new Map();
        this.moderationHistory = new Map();
        this.loadData();
        
        // Auto-save toutes les 5 minutes
        setInterval(() => this.saveData(), 5 * 60 * 1000);
    }

    loadData() {
        try {
            const dataPath = path.join(__dirname, '..', 'data', 'moderation.json');
            if (fs.existsSync(dataPath)) {
                const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                this.userWarnings = new Map(data.warnings || []);
                this.tempBans = new Map(data.tempBans || []);
                this.autoModRules = new Map(data.autoModRules || []);
                this.moderationHistory = new Map(data.history || []);
            }
        } catch (error) {
            console.error('Erreur chargement données modération:', error);
        }
    }

    saveData() {
        try {
            const dataPath = path.join(__dirname, '..', 'data', 'moderation.json');
            const data = {
                warnings: Array.from(this.userWarnings.entries()),
                tempBans: Array.from(this.tempBans.entries()),
                autoModRules: Array.from(this.autoModRules.entries()),
                history: Array.from(this.moderationHistory.entries())
            };
            fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Erreur sauvegarde données modération:', error);
        }
    }

    // === COMMANDES DE MODÉRATION AVANCÉES ===

    async banUser(interaction, targetUser, reason, duration = null) {
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
                return await interaction.reply({
                    content: this.lang.t('system.no_permission'),
                    ephemeral: true
                });
            }

            const guild = interaction.guild;
            const member = await guild.members.fetch(targetUser.id).catch(() => null);

            if (member && member.roles.highest.position >= interaction.member.roles.highest.position) {
                return await interaction.reply({
                    content: '❌ Vous ne pouvez pas bannir cet utilisateur (rôle supérieur).',
                    ephemeral: true
                });
            }

            // Bannissement temporaire
            if (duration) {
                const unbanTime = Date.now() + this.parseDuration(duration);
                this.tempBans.set(`${guild.id}_${targetUser.id}`, {
                    unbanTime,
                    reason,
                    moderator: interaction.user.id
                });
                
                // Programmer le débannissement
                setTimeout(() => {
                    this.autoUnban(guild.id, targetUser.id);
                }, this.parseDuration(duration));
            }

            // Envoyer DM avant ban
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🔨 Bannissement')
                    .setDescription(this.lang.t('moderation.ban.dm_message', { 
                        guild: guild.name, 
                        reason: reason || 'Aucune raison fournie' 
                    }))
                    .addFields({ 
                        name: 'Durée', 
                        value: duration || 'Permanent', 
                        inline: true 
                    })
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log('Impossible d\'envoyer le DM de ban');
            }

            // Bannir l'utilisateur
            await guild.bans.create(targetUser.id, { 
                reason: `${reason} | Par: ${interaction.user.tag}`,
                deleteMessageDays: 1
            });

            // Log de modération
            this.logModerationAction('ban', {
                userId: targetUser.id,
                moderatorId: interaction.user.id,
                reason,
                duration,
                timestamp: Date.now(),
                guildId: guild.id
            });

            // Réponse
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🔨 Utilisateur banni')
                .setDescription(this.lang.t('moderation.ban.success', { user: targetUser.tag }))
                .addFields(
                    { name: 'Raison', value: reason || 'Aucune', inline: true },
                    { name: 'Durée', value: duration || 'Permanent', inline: true },
                    { name: 'Modérateur', value: interaction.user.tag, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur ban:', error);
            await interaction.reply({
                content: this.lang.t('moderation.ban.error'),
                ephemeral: true
            });
        }
    }

    async kickUser(interaction, targetUser, reason) {
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
                return await interaction.reply({
                    content: this.lang.t('system.no_permission'),
                    ephemeral: true
                });
            }

            const guild = interaction.guild;
            const member = await guild.members.fetch(targetUser.id);

            if (!member) {
                return await interaction.reply({
                    content: '❌ Utilisateur non trouvé sur ce serveur.',
                    ephemeral: true
                });
            }

            if (member.roles.highest.position >= interaction.member.roles.highest.position) {
                return await interaction.reply({
                    content: '❌ Vous ne pouvez pas expulser cet utilisateur (rôle supérieur).',
                    ephemeral: true
                });
            }

            // Envoyer DM avant kick
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('👢 Expulsion')
                    .setDescription(this.lang.t('moderation.kick.dm_message', { 
                        guild: guild.name, 
                        reason: reason || 'Aucune raison fournie' 
                    }))
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log('Impossible d\'envoyer le DM de kick');
            }

            // Expulser l'utilisateur
            await member.kick(`${reason} | Par: ${interaction.user.tag}`);

            // Log de modération
            this.logModerationAction('kick', {
                userId: targetUser.id,
                moderatorId: interaction.user.id,
                reason,
                timestamp: Date.now(),
                guildId: guild.id
            });

            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('👢 Utilisateur expulsé')
                .setDescription(this.lang.t('moderation.kick.success', { user: targetUser.tag }))
                .addFields(
                    { name: 'Raison', value: reason || 'Aucune', inline: true },
                    { name: 'Modérateur', value: interaction.user.tag, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur kick:', error);
            await interaction.reply({
                content: '❌ Erreur lors de l\'expulsion.',
                ephemeral: true
            });
        }
    }

    async muteUser(interaction, targetUser, duration, reason) {
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return await interaction.reply({
                    content: this.lang.t('system.no_permission'),
                    ephemeral: true
                });
            }

            const guild = interaction.guild;
            const member = await guild.members.fetch(targetUser.id);

            if (!member) {
                return await interaction.reply({
                    content: '❌ Utilisateur non trouvé sur ce serveur.',
                    ephemeral: true
                });
            }

            const durationMs = this.parseDuration(duration);
            const muteUntil = Date.now() + durationMs;

            // Timeout Discord natif
            await member.timeout(durationMs, `${reason} | Par: ${interaction.user.tag}`);

            // Envoyer DM
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('🔇 Mise en sourdine')
                    .setDescription(this.lang.t('moderation.mute.dm_message', { 
                        guild: guild.name, 
                        reason: reason || 'Aucune raison fournie' 
                    }))
                    .addFields({ 
                        name: 'Durée', 
                        value: duration, 
                        inline: true 
                    })
                    .setTimestamp();

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log('Impossible d\'envoyer le DM de mute');
            }

            // Log de modération
            this.logModerationAction('mute', {
                userId: targetUser.id,
                moderatorId: interaction.user.id,
                reason,
                duration,
                timestamp: Date.now(),
                guildId: guild.id
            });

            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('🔇 Utilisateur mis en sourdine')
                .setDescription(this.lang.t('moderation.mute.success', { 
                    user: targetUser.tag, 
                    duration 
                }))
                .addFields(
                    { name: 'Raison', value: reason || 'Aucune', inline: true },
                    { name: 'Durée', value: duration, inline: true },
                    { name: 'Modérateur', value: interaction.user.tag, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur mute:', error);
            await interaction.reply({
                content: '❌ Erreur lors de la mise en sourdine.',
                ephemeral: true
            });
        }
    }

    async warnUser(interaction, targetUser, reason) {
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return await interaction.reply({
                    content: this.lang.t('system.no_permission'),
                    ephemeral: true
                });
            }

            const guild = interaction.guild;
            const userId = `${guild.id}_${targetUser.id}`;
            
            // Ajouter l'avertissement
            const warnings = this.userWarnings.get(userId) || [];
            warnings.push({
                id: Date.now(),
                reason: reason || 'Aucune raison fournie',
                moderator: interaction.user.id,
                timestamp: Date.now()
            });
            this.userWarnings.set(userId, warnings);

            // Actions automatiques basées sur le nombre d'avertissements
            const warnCount = warnings.length;
            let autoAction = null;

            if (warnCount >= 5) {
                // Ban après 5 avertissements
                try {
                    await guild.bans.create(targetUser.id, { 
                        reason: 'Ban automatique - 5 avertissements' 
                    });
                    autoAction = 'Ban automatique';
                } catch (error) {
                    console.error('Erreur ban automatique:', error);
                }
            } else if (warnCount >= 3) {
                // Mute 24h après 3 avertissements
                try {
                    const member = await guild.members.fetch(targetUser.id);
                    await member.timeout(24 * 60 * 60 * 1000, 'Mute automatique - 3 avertissements');
                    autoAction = 'Mute 24h automatique';
                } catch (error) {
                    console.error('Erreur mute automatique:', error);
                }
            }

            // Envoyer DM
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#ffff00')
                    .setTitle('⚠️ Avertissement')
                    .setDescription(this.lang.t('moderation.warn.dm_message', { 
                        guild: guild.name, 
                        reason: reason || 'Aucune raison fournie' 
                    }))
                    .addFields(
                        { name: 'Nombre d\'avertissements', value: `${warnCount}/5`, inline: true }
                    )
                    .setTimestamp();

                if (autoAction) {
                    dmEmbed.addFields({ name: 'Action automatique', value: autoAction, inline: true });
                }

                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log('Impossible d\'envoyer le DM d\'avertissement');
            }

            // Log de modération
            this.logModerationAction('warn', {
                userId: targetUser.id,
                moderatorId: interaction.user.id,
                reason,
                warnCount,
                autoAction,
                timestamp: Date.now(),
                guildId: guild.id
            });

            const embed = new EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('⚠️ Avertissement donné')
                .setDescription(this.lang.t('moderation.warn.success', { user: targetUser.tag }))
                .addFields(
                    { name: 'Raison', value: reason || 'Aucune', inline: true },
                    { name: 'Avertissements total', value: `${warnCount}/5`, inline: true },
                    { name: 'Modérateur', value: interaction.user.tag, inline: true }
                )
                .setTimestamp();

            if (autoAction) {
                embed.addFields({ name: 'Action automatique', value: autoAction, inline: false });
            }

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur warn:', error);
            await interaction.reply({
                content: '❌ Erreur lors de l\'avertissement.',
                ephemeral: true
            });
        }
    }

    async setSlowmode(interaction, duration) {
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return await interaction.reply({
                    content: this.lang.t('system.no_permission'),
                    ephemeral: true
                });
            }

            const channel = interaction.channel;
            const seconds = parseInt(duration) || 0;

            if (seconds < 0 || seconds > 21600) { // Max 6 heures
                return await interaction.reply({
                    content: '❌ La durée doit être entre 0 et 21600 secondes (6h).',
                    ephemeral: true
                });
            }

            await channel.setRateLimitPerUser(seconds);

            const embed = new EmbedBuilder()
                .setColor(seconds > 0 ? '#ffaa00' : '#00ff00')
                .setTitle('⏱️ Mode lent modifié')
                .setDescription(seconds > 0 
                    ? this.lang.t('moderation.slowmode.success', { duration: `${seconds}` })
                    : this.lang.t('moderation.slowmode.disabled')
                )
                .addFields({ 
                    name: 'Modérateur', 
                    value: interaction.user.tag, 
                    inline: true 
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur slowmode:', error);
            await interaction.reply({
                content: '❌ Erreur lors de la modification du mode lent.',
                ephemeral: true
            });
        }
    }

    async lockChannel(interaction, reason) {
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return await interaction.reply({
                    content: this.lang.t('system.no_permission'),
                    ephemeral: true
                });
            }

            const channel = interaction.channel;
            const everyone = interaction.guild.roles.everyone;

            // Vérifier si déjà verrouillé
            const permissions = channel.permissionOverwrites.cache.get(everyone.id);
            if (permissions && permissions.deny.has(PermissionFlagsBits.SendMessages)) {
                return await interaction.reply({
                    content: this.lang.t('moderation.lock.already_locked'),
                    ephemeral: true
                });
            }

            await channel.permissionOverwrites.edit(everyone, {
                SendMessages: false
            });

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🔒 Salon verrouillé')
                .setDescription(this.lang.t('moderation.lock.success'))
                .addFields(
                    { name: 'Raison', value: reason || 'Aucune', inline: true },
                    { name: 'Modérateur', value: interaction.user.tag, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur lock:', error);
            await interaction.reply({
                content: '❌ Erreur lors du verrouillage.',
                ephemeral: true
            });
        }
    }

    async unlockChannel(interaction) {
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return await interaction.reply({
                    content: this.lang.t('system.no_permission'),
                    ephemeral: true
                });
            }

            const channel = interaction.channel;
            const everyone = interaction.guild.roles.everyone;

            // Vérifier si verrouillé
            const permissions = channel.permissionOverwrites.cache.get(everyone.id);
            if (!permissions || !permissions.deny.has(PermissionFlagsBits.SendMessages)) {
                return await interaction.reply({
                    content: this.lang.t('moderation.unlock.not_locked'),
                    ephemeral: true
                });
            }

            await channel.permissionOverwrites.edit(everyone, {
                SendMessages: null
            });

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🔓 Salon déverrouillé')
                .setDescription(this.lang.t('moderation.unlock.success'))
                .addFields({ 
                    name: 'Modérateur', 
                    value: interaction.user.tag, 
                    inline: true 
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur unlock:', error);
            await interaction.reply({
                content: '❌ Erreur lors du déverrouillage.',
                ephemeral: true
            });
        }
    }

    // === MODÉRATION AUTOMATIQUE ===

    async checkAutoModeration(message) {
        if (message.author.bot) return false;

        const guild = message.guild;
        if (!guild) return false;

        let violations = [];

        // Vérifier les liens non autorisés
        if (this.containsUnauthorizedLinks(message.content)) {
            violations.push('unauthorized_links');
        }

        // Vérifier le spam de majuscules
        if (this.isExcessiveCaps(message.content)) {
            violations.push('excessive_caps');
        }

        // Vérifier les mentions de masse
        if (this.isMassMention(message)) {
            violations.push('mass_mention');
        }

        // Vérifier les mots interdits
        if (this.containsBannedWords(message.content)) {
            violations.push('banned_words');
        }

        // Vérifier le spam rapide
        if (await this.isRapidSpam(message.author.id, guild.id)) {
            violations.push('rapid_spam');
        }

        // Appliquer les sanctions
        if (violations.length > 0) {
            await this.applyAutoModeration(message, violations);
            return true;
        }

        return false;
    }

    /**
     * Vérifie et applique la modération automatique sur un message
     */
    async checkMessage(message) {
        // Copie la logique de modération automatique
        if (message.author.bot) return false;
        const guild = message.guild;
        if (!guild) return false;
        let violations = [];
        if (this.containsUnauthorizedLinks(message.content)) violations.push('unauthorized_links');
        if (this.isExcessiveCaps(message.content)) violations.push('excessive_caps');
        if (this.isMassMention(message)) violations.push('mass_mention');
        if (this.containsBannedWords(message.content)) violations.push('banned_words');
        if (await this.isRapidSpam(message.author.id, guild.id)) violations.push('rapid_spam');
        if (violations.length > 0) {
            await this.applyAutoModeration(message, violations);
            return true;
        }
        return false;
    }

    containsUnauthorizedLinks(content) {
        const linkRegex = /(https?:\/\/[^\s]+)/gi;
        const authorizedDomains = ['discord.gg', 'discord.com', 'github.com', 'fsprotect.fr'];
        
        const links = content.match(linkRegex);
        if (!links) return false;

        return links.some(link => {
            return !authorizedDomains.some(domain => link.includes(domain));
        });
    }

    isExcessiveCaps(content) {
        if (content.length < 10) return false;
        const capsCount = (content.match(/[A-Z]/g) || []).length;
        return (capsCount / content.length) > 0.7;
    }

    isMassMention(message) {
        return message.mentions.users.size > 5 || message.mentions.roles.size > 3;
    }

    containsBannedWords(content) {
        const bannedWords = ['spam', 'hack', 'cheat', 'exploit']; // Liste basique
        const lowerContent = content.toLowerCase();
        return bannedWords.some(word => lowerContent.includes(word));
    }

    async isRapidSpam(userId, guildId) {
        // Implémenter la détection de spam rapide
        // Vérifier si l'utilisateur a envoyé trop de messages rapidement
        return false; // Placeholder
    }

    async applyAutoModeration(message, violations) {
        try {
            // Supprimer le message
            await message.delete();

            // Créer un embed d'avertissement
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚨 Modération automatique')
                .setDescription(`Message supprimé de ${message.author.tag}`)
                .addFields(
                    { name: 'Violations', value: violations.join(', '), inline: true },
                    { name: 'Salon', value: message.channel.name, inline: true }
                )
                .setTimestamp();

            // Envoyer dans le salon de logs (si configuré)
            const logChannel = message.guild.channels.cache.find(c => c.name === 'logs-modération');
            if (logChannel) {
                await logChannel.send({ embeds: [embed] });
            }

            // Avertir l'utilisateur en DM
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('⚠️ Message supprimé')
                    .setDescription('Votre message a été supprimé par la modération automatique.')
                    .addFields({ name: 'Raison', value: violations.join(', ') })
                    .setTimestamp();

                await message.author.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log('Impossible d\'envoyer le DM d\'auto-modération');
            }

        } catch (error) {
            console.error('Erreur auto-modération:', error);
        }
    }

    // === UTILITAIRES ===

    parseDuration(duration) {
        const matches = duration.match(/(\d+)([smhdw])/g);
        if (!matches) return 0;

        let totalMs = 0;
        for (const match of matches) {
            const value = parseInt(match.slice(0, -1));
            const unit = match.slice(-1);

            switch (unit) {
                case 's': totalMs += value * 1000; break;
                case 'm': totalMs += value * 60 * 1000; break;
                case 'h': totalMs += value * 60 * 60 * 1000; break;
                case 'd': totalMs += value * 24 * 60 * 60 * 1000; break;
                case 'w': totalMs += value * 7 * 24 * 60 * 60 * 1000; break;
            }
        }

        return totalMs;
    }

    async autoUnban(guildId, userId) {
        try {
            const client = require('../index.js').client; // Référence au client
            const guild = await client.guilds.fetch(guildId);
            await guild.bans.remove(userId, 'Ban temporaire expiré');
            
            this.tempBans.delete(`${guildId}_${userId}`);
            console.log(`Auto-unban: ${userId} from ${guildId}`);
        } catch (error) {
            console.error('Erreur auto-unban:', error);
        }
    }

    logModerationAction(action, data) {
        const logKey = `${data.guildId}_${Date.now()}`;
        this.moderationHistory.set(logKey, {
            action,
            ...data
        });

        // Garder seulement les 1000 derniers logs
        if (this.moderationHistory.size > 1000) {
            const oldestKey = this.moderationHistory.keys().next().value;
            this.moderationHistory.delete(oldestKey);
        }
    }

    getModerationStats(guildId) {
        const stats = {
            totalActions: 0,
            bans: 0,
            kicks: 0,
            mutes: 0,
            warns: 0,
            autoActions: 0
        };

        for (const [key, data] of this.moderationHistory) {
            if (data.guildId === guildId) {
                stats.totalActions++;
                stats[data.action + 's'] = (stats[data.action + 's'] || 0) + 1;
                if (data.autoAction) stats.autoActions++;
            }
        }

        return stats;
    }

    getUserWarnings(guildId, userId) {
        return this.userWarnings.get(`${guildId}_${userId}`) || [];
    }

    clearUserWarnings(guildId, userId) {
        this.userWarnings.delete(`${guildId}_${userId}`);
        this.saveData();
    }
}

module.exports = AdvancedModeration;
