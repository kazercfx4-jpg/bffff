const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    Collection, 
    EmbedBuilder,
    AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const commands = require('./commands');
const FSProtectObfuscator = require('./obfuscator');

// Systèmes
const LanguageManager = require('./systems/language');
const ModerationSystem = require('./systems/moderation');
const AdminSystem = require('./systems/administration');
const PermissionSystem = require('./systems/permissions');
const BackupSystem = require('./systems/backup');
const LoggingSystem = require('./systems/logging');
const TicketSystem = require('./systems/tickets');
const AntiRaidSystem = require('./systems/antiraid');
const AccessManager = require('./systems/access');

class FSProtectBot {
    constructor() {
        // Configuration du client Discord
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.DirectMessages
            ],
            partials: [Partials.Channel, Partials.Message]
        });

        // Systèmes
        this.languageManager = new LanguageManager();
        this.moderationSystem = new ModerationSystem();
        this.adminSystem = new AdminSystem();
        this.permissionSystem = new PermissionSystem();
        this.backupSystem = new BackupSystem();
        this.loggingSystem = new LoggingSystem();
        this.ticketSystem = new TicketSystem();
        this.antiRaidSystem = new AntiRaidSystem();
        this.accessManager = new AccessManager();

        // Collections
        this.client.commands = new Collection();
        this.cooldowns = new Collection();

        // Initialisation
        this.setupEvents();
        this.setupCommands();
    }

    setupEvents() {
        // Event: Ready
        this.client.once('ready', () => {
            console.log(`✅ ${this.client.user.tag} est en ligne !`);
            this.antiRaidSystem.start();
        });

        // Event: Interaction
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            const command = this.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await this.executeCommand(interaction);
            } catch (error) {
                console.error('Erreur commande:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'Une erreur est survenue lors de l\'exécution de cette commande.',
                        ephemeral: true
                    });
                }
            }
        });

        // Event: Message
        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            await this.moderationSystem.handleMessage(message);
            await this.antiRaidSystem.handleMessage(message);
        });

        // Event: Member Join
        this.client.on('guildMemberAdd', async (member) => {
            await this.antiRaidSystem.handleMemberJoin(member);
            await this.loggingSystem.logMemberJoin(member);
        });
    }

    setupCommands() {
        try {
            console.log('Début du chargement des commandes...');
            
            // Charger les commandes
            let slashCommands;
            try {
                slashCommands = require('./commands');
                console.log('Type de slashCommands:', typeof slashCommands);
                console.log('Est un tableau:', Array.isArray(slashCommands));
                if (Array.isArray(slashCommands)) {
                    console.log('Nombre de commandes trouvées:', slashCommands.length);
                }
            } catch (requireError) {
                console.error('Erreur lors du chargement du fichier commands.js:', requireError);
                return;
            }
            
            // Vérifier si slashCommands est un tableau valide
            if (!Array.isArray(slashCommands)) {
                console.error('Erreur: commands.js doit exporter un tableau de commandes');
                console.error('Reçu:', slashCommands);
                return;
            }
            
            // Charger chaque commande
            let loadedCount = 0;
            for (const command of slashCommands) {
                try {
                    if (!command || typeof command.toJSON !== 'function') {
                        console.warn('Commande invalide ignorée:', command);
                        continue;
                    }
                    
                    const commandData = command.toJSON();
                    const commandName = commandData.name;
                    this.client.commands.set(commandName, {
                        data: command,
                        execute: async (interaction) => {
                            await this.executeCommand(interaction);
                        }
                    });
                    loadedCount++;
                    console.log(`Commande "${commandName}" chargée avec succès`);
                } catch (commandError) {
                    console.error('Erreur lors du chargement d\'une commande:', commandError);
                }
            }
            
            console.log(`✅ ${loadedCount}/${slashCommands.length} commandes chargées avec succès`);
        } catch (error) {
            console.error('Erreur lors du chargement des commandes:', error);
        }
    }

    async executeCommand(interaction) {
        const { commandName, options } = interaction;
        const lang = await this.languageManager.getUserLanguage(interaction.user.id);
        const subcommand = options.getSubcommand(false);
        const subcommandGroup = options.getSubcommandGroup(false);

        // Vérification des permissions
        if (!await this.permissionSystem.checkPermission(interaction, commandName)) {
            return await interaction.reply({
                content: lang === 'fr' 
                    ? '❌ Vous n\'avez pas la permission d\'utiliser cette commande.' 
                    : '❌ You don\'t have permission to use this command.',
                ephemeral: true
            });
        }

        // Exécution des commandes
        try {
            switch (commandName) {
                case 'admin':
                    if (subcommandGroup === 'users') {
                        await this.adminSystem.handleUserCommand(interaction, subcommand, lang);
                    } else if (subcommandGroup === 'system') {
                        await this.adminSystem.handleSystemCommand(interaction, subcommand, lang);
                    }
                    break;

                case 'mod':
                    await this.handleModCommand(interaction, subcommand, lang);
                    break;

                case 'antiraid':
                    await this.antiRaidSystem.handleCommand(interaction, subcommand, lang);
                    break;

                case 'antiping':
                    await this.moderationSystem.handlePingProtection(interaction, subcommand, lang);
                    break;

                case 'antilink':
                    await this.handleAntilinkCommand(interaction, lang);
                    break;

                case 'antibot':
                    await this.handleAntibotCommand(interaction, lang);
                    break;

                case 'antichannel':
                    await this.handleAntichannelCommand(interaction, lang);
                    break;

                case 'antitoken':
                    await this.handleAntitokenCommand(interaction, lang);
                    break;

                case 'autoconfiglog':
                    await this.handleAutoconfiglogCommand(interaction, lang);
                    break;

                case 'raidping':
                    await this.handleRaidpingCommand(interaction, lang);
                    break;

                case 'crypter':
                    await this.handleCrypterCommand(interaction, lang);
                    break;

                case 'protect':
                    await this.handleProtectCommand(interaction, lang);
                    break;

                case 'access':
                    await this.accessManager.handleCommand(interaction, subcommand, lang);
                    break;

                case 'subscription':
                    await this.handleSubscriptionCommand(interaction, subcommand, lang);
                    break;

                case 'ticketpanel':
                    await this.ticketSystem.createPanel(interaction, lang);
                    break;

                case 'ticket':
                    switch(subcommand) {
                        case 'create':
                            const category = interaction.options.getString('category');
                            const reason = interaction.options.getString('reason');
                            const priority = interaction.options.getString('priority') || 'low';
                            await this.ticketSystem.createTicket(interaction, category, reason, priority, lang);
                            break;
                        case 'close':
                            await this.ticketSystem.closeTicket(interaction, lang);
                            break;
                        case 'add':
                            const addUser = interaction.options.getUser('user');
                            await this.ticketSystem.addUserToTicket(interaction, addUser, lang);
                            break;
                        case 'remove':
                            const removeUser = interaction.options.getUser('user');
                            await this.ticketSystem.removeUserFromTicket(interaction, removeUser, lang);
                            break;
                    }
                    break;

                case 'settings':
                    if (subcommand === 'language') {
                        const newLang = options.getString('lang');
                        await this.languageManager.setUserLanguage(interaction.user.id, newLang);
                        await interaction.reply({
                            content: newLang === 'fr' 
                                ? '✅ Langue changée en Français' 
                                : '✅ Language changed to English',
                            ephemeral: true
                        });
                    }
                    break;

                case 'help':
                    await this.handleHelpCommand(interaction, lang);
                    break;

                case 'status':
                    await this.handleStatusCommand(interaction, lang);
                    break;

                case 'profile':
                    await this.handleProfileCommand(interaction, lang);
                    break;

                default:
                    await interaction.reply({
                        content: lang === 'fr' ? 'Commande inconnue.' : 'Unknown command.',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error(`Erreur dans la commande ${commandName}:`, error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: lang === 'fr'
                        ? '❌ Une erreur est survenue lors de l\'exécution de cette commande.'
                        : '❌ An error occurred while executing this command.',
                    ephemeral: true
                });
            }
        }
    }

    // Nouvelles méthodes pour gérer les commandes de modération
    async handleModCommand(interaction, subcommand, lang) {
        switch(subcommand) {
            case 'mute':
                const muteUser = interaction.options.getUser('user');
                const muteReason = interaction.options.getString('reason') || (lang === 'fr' ? 'Aucune raison spécifiée' : 'No reason specified');
                const muteDuration = interaction.options.getString('duration') || '60m';
                await this.moderationSystem.muteUser(interaction, muteUser, muteReason, muteDuration, lang);
                break;

            case 'unmute':
                const unmuteUser = interaction.options.getUser('user');
                await this.moderationSystem.unmuteUser(interaction, unmuteUser, lang);
                break;

            case 'clear':
                const amount = interaction.options.getNumber('amount');
                const targetUser = interaction.options.getUser('user');
                await this.moderationSystem.clearMessages(interaction, amount, targetUser, lang);
                break;

            case 'bl':
                const blUser = interaction.options.getUser('user');
                const blReason = interaction.options.getString('reason') || (lang === 'fr' ? 'Aucune raison spécifiée' : 'No reason specified');
                await this.moderationSystem.blacklistUser(interaction, blUser, blReason, lang);
                break;

            case 'unbl':
                const unblUser = interaction.options.getUser('user');
                await this.moderationSystem.unblacklistUser(interaction, unblUser, lang);
                break;

            default:
                await this.moderationSystem.handleCommand(interaction, subcommand, lang);
        }
    }

    async handleAntilinkCommand(interaction, lang) {
        const mode = interaction.options.getString('mode');
        
        try {
            await this.moderationSystem.setAntilinkMode(interaction.guild.id, mode === 'on');
            
            await interaction.reply({
                content: lang === 'fr'
                    ? `✅ Protection contre les liens ${mode === 'on' ? 'activée' : 'désactivée'}`
                    : `✅ Link protection ${mode === 'on' ? 'enabled' : 'disabled'}`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Erreur antilink:', error);
            await interaction.reply({
                content: lang === 'fr'
                    ? '❌ Erreur lors de la configuration de l\'antilink'
                    : '❌ Error configuring antilink',
                ephemeral: true
            });
        }
    }

    async handleAntibotCommand(interaction, lang) {
        const mode = interaction.options.getString('mode');
        
        try {
            await this.moderationSystem.setAntibotMode(interaction.guild.id, mode === 'on');
            
            await interaction.reply({
                content: lang === 'fr'
                    ? `✅ Protection contre les bots ${mode === 'on' ? 'activée' : 'désactivée'}`
                    : `✅ Bot protection ${mode === 'on' ? 'enabled' : 'disabled'}`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Erreur antibot:', error);
            await interaction.reply({
                content: lang === 'fr'
                    ? '❌ Erreur lors de la configuration de l\'antibot'
                    : '❌ Error configuring antibot',
                ephemeral: true
            });
        }
    }

    async handleAntichannelCommand(interaction, lang) {
        const mode = interaction.options.getString('mode');
        
        try {
            await this.moderationSystem.setAntichannelMode(interaction.guild.id, mode === 'on');
            
            await interaction.reply({
                content: lang === 'fr'
                    ? `✅ Protection contre la création de salons ${mode === 'on' ? 'activée' : 'désactivée'}`
                    : `✅ Channel creation protection ${mode === 'on' ? 'enabled' : 'disabled'}`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Erreur antichannel:', error);
            await interaction.reply({
                content: lang === 'fr'
                    ? '❌ Erreur lors de la configuration de l\'antichannel'
                    : '❌ Error configuring antichannel',
                ephemeral: true
            });
        }
    }

    async handleAntitokenCommand(interaction, lang) {
        const mode = interaction.options.getString('mode');
        
        try {
            await this.moderationSystem.setAntitokenMode(interaction.guild.id, mode === 'on');
            
            await interaction.reply({
                content: lang === 'fr'
                    ? `✅ Protection contre les tokens ${mode === 'on' ? 'activée' : 'désactivée'}`
                    : `✅ Token protection ${mode === 'on' ? 'enabled' : 'disabled'}`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Erreur antitoken:', error);
            await interaction.reply({
                content: lang === 'fr'
                    ? '❌ Erreur lors de la configuration de l\'antitoken'
                    : '❌ Error configuring antitoken',
                ephemeral: true
            });
        }
    }

    async handleAutoconfiglogCommand(interaction, lang) {
        try {
            await this.loggingSystem.autoconfigureLogs(interaction.guild, lang);
            
            await interaction.reply({
                content: lang === 'fr'
                    ? '✅ Salons de logs configurés automatiquement'
                    : '✅ Log channels configured automatically',
                ephemeral: true
            });
        } catch (error) {
            console.error('Erreur autoconfiglog:', error);
            await interaction.reply({
                content: lang === 'fr'
                    ? '❌ Erreur lors de la configuration automatique des logs'
                    : '❌ Error during automatic log configuration',
                ephemeral: true
            });
        }
    }

    async handleRaidpingCommand(interaction, lang) {
        const role = interaction.options.getRole('role');
        
        try {
            await this.antiRaidSystem.setRaidPingRole(interaction.guild.id, role.id);
            
            await interaction.reply({
                content: lang === 'fr'
                    ? `✅ Rôle de raid ping configuré sur ${role.name}`
                    : `✅ Raid ping role set to ${role.name}`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Erreur raidping:', error);
            await interaction.reply({
                content: lang === 'fr'
                    ? '❌ Erreur lors de la configuration du rôle de raid ping'
                    : '❌ Error configuring raid ping role',
                ephemeral: true
            });
        }
    }

    async handleProtectCommand(interaction, lang) {
        const file = interaction.options.getAttachment('file');
        const preset = interaction.options.getString('preset') || 'gaming';
        const layers = interaction.options.getNumber('layers') || 15;
        const ultraMode = interaction.options.getBoolean('ultra_mode') || false;

        await interaction.deferReply();

        try {
            if (!file.name.endsWith('.lua')) {
                throw new Error('InvalidFileType');
            }

            const response = await fetch(file.url);
            const fileContent = await response.text();

            const obfuscator = new FSProtectObfuscator();
            const obfuscated = await obfuscator.obfuscateFile(fileContent, file.name, preset);

            const resultBuffer = Buffer.from(obfuscated, 'utf-8');
            const resultAttachment = new AttachmentBuilder(resultBuffer, {
                name: `${file.name.replace('.lua', '')}_protected.lua`
            });

            await interaction.editReply({
                content: lang === 'fr'
                    ? `✅ Fichier protégé avec succès!\nPreset: ${preset}\nCouches: ${layers}\nMode ultra: ${ultraMode ? 'Activé' : 'Désactivé'}`
                    : `✅ File successfully protected!\nPreset: ${preset}\nLayers: ${layers}\nUltra mode: ${ultraMode ? 'Enabled' : 'Disabled'}`,
                files: [resultAttachment]
            });

        } catch (error) {
            console.error('Erreur protection:', error);
            let errorMessage = lang === 'fr'
                ? '❌ Une erreur est survenue lors de la protection.'
                : '❌ An error occurred during protection.';

            if (error.message === 'InvalidFileType') {
                errorMessage = lang === 'fr'
                    ? '❌ Seuls les fichiers Lua (.lua) sont acceptés.'
                    : '❌ Only Lua files (.lua) are accepted.';
            }

            await interaction.editReply({ content: errorMessage });
        }
    }

    async handleSubscriptionCommand(interaction, subcommand, lang) {
        switch(subcommand) {
            case 'add':
                const user = interaction.options.getUser('user');
                const plan = interaction.options.getString('plan');
                const limit = interaction.options.getNumber('limit');
                const embedColor = interaction.options.getString('embed_color');
                
                try {
                    await this.accessManager.addSubscription(user.id, plan, limit, embedColor);
                    await interaction.reply({
                        content: lang === 'fr'
                            ? `✅ Abonnement ${plan} ajouté pour ${user.username}`
                            : `✅ ${plan} subscription added for ${user.username}`,
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('Erreur ajout abonnement:', error);
                    await interaction.reply({
                        content: lang === 'fr'
                            ? '❌ Erreur lors de l\'ajout de l\'abonnement'
                            : '❌ Error adding subscription',
                        ephemeral: true
                    });
                }
                break;

            case 'remove':
                const removeUser = interaction.options.getUser('user');
                
                try {
                    await this.accessManager.removeSubscription(removeUser.id);
                    await interaction.reply({
                        content: lang === 'fr'
                            ? `✅ Abonnement supprimé pour ${removeUser.username}`
                            : `✅ Subscription removed for ${removeUser.username}`,
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('Erreur suppression abonnement:', error);
                    await interaction.reply({
                        content: lang === 'fr'
                            ? '❌ Erreur lors de la suppression de l\'abonnement'
                            : '❌ Error removing subscription',
                        ephemeral: true
                    });
                }
                break;

            case 'info':
                const infoUser = interaction.options.getUser('user');
                
                try {
                    const subscription = await this.accessManager.getUserSubscription(infoUser.id);
                    if (!subscription) {
                        await interaction.reply({
                            content: lang === 'fr'
                                ? `❌ ${infoUser.username} n'a pas d'abonnement`
                                : `❌ ${infoUser.username} has no subscription`,
                            ephemeral: true
                        });
                        return;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle(lang === 'fr' ? 'Informations Abonnement' : 'Subscription Information')
                        .setDescription(`${infoUser.username}`)
                        .addFields(
                            { name: 'Plan', value: subscription.plan, inline: true },
                            { name: 'Limite', value: subscription.limit.toString(), inline: true },
                            { name: 'Utilisation', value: `${subscription.usage || 0}/${subscription.limit}`, inline: true }
                        )
                        .setColor(subscription.embedColor || '#0099ff');

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                } catch (error) {
                    console.error('Erreur info abonnement:', error);
                    await interaction.reply({
                        content: lang === 'fr'
                            ? '❌ Erreur lors de la récupération des informations'
                            : '❌ Error retrieving information',
                        ephemeral: true
                    });
                }
                break;

            case 'list':
                try {
                    const subscriptions = await this.accessManager.getAllSubscriptions();
                    
                    const embed = new EmbedBuilder()
                        .setTitle(lang === 'fr' ? 'Liste des Abonnements' : 'Subscription List')
                        .setColor('#0099ff');

                    if (subscriptions.length === 0) {
                        embed.setDescription(lang === 'fr' ? 'Aucun abonnement trouvé' : 'No subscriptions found');
                    } else {
                        const description = subscriptions.map(sub => 
                            `<@${sub.userId}> - ${sub.plan} (${sub.usage || 0}/${sub.limit})`
                        ).join('\n');
                        embed.setDescription(description);
                    }

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                } catch (error) {
                    console.error('Erreur liste abonnements:', error);
                    await interaction.reply({
                        content: lang === 'fr'
                            ? '❌ Erreur lors de la récupération de la liste'
                            : '❌ Error retrieving list',
                        ephemeral: true
                    });
                }
                break;
        }
    }

    // Commandes spécifiques
    async handleHelpCommand(interaction, lang) {
        const category = interaction.options.getString('category');
        
        const embed = new EmbedBuilder()
            .setTitle(lang === 'fr' ? '📚 Aide' : '📚 Help')
            .setDescription(lang === 'fr' 
                ? 'Liste des commandes disponibles'
                : 'List of available commands'
            )
            .setColor('#0099ff');

        if (!category || category === 'admin') {
            embed.addFields({
                name: lang === 'fr' ? '🛡️ Administration' : '🛡️ Administration',
                value: '`/admin users` `/admin system`'
            });
        }

        if (!category || category === 'mod') {
            embed.addFields({
                name: lang === 'fr' ? '👮 Modération' : '👮 Moderation',
                value: '`/mod mute` `/mod unmute` `/mod clear` `/mod bl` `/mod unbl`'
            });
        }

        if (!category || category === 'protection') {
            embed.addFields({
                name: lang === 'fr' ? '🔒 Protection' : '🔒 Protection',
                value: '`/antiraid` `/antiping` `/antilink` `/antibot` `/antichannel` `/antitoken` `/raidping`'
            });
        }

        if (!category || category === 'utils') {
            embed.addFields({
                name: lang === 'fr' ? '📊 Utilitaires' : '📊 Utilities',
                value: '`/help` `/status` `/profile` `/settings` `/crypter` `/protect`'
            });
        }

        await interaction.reply({ embeds: [embed] });
    }

    async handleStatusCommand(interaction, lang) {
        const embed = new EmbedBuilder()
            .setTitle(lang === 'fr' ? '📊 Status du Bot' : '📊 Bot Status')
            .setColor('#00ff00')
            .addFields(
                {
                    name: lang === 'fr' ? 'État' : 'Status',
                    value: '🟢 ' + (lang === 'fr' ? 'En ligne' : 'Online'),
                    inline: true
                },
                {
                    name: 'Uptime',
                    value: this.formatUptime(process.uptime()),
                    inline: true
                },
                {
                    name: lang === 'fr' ? 'Utilisation Mémoire' : 'Memory Usage',
                    value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
                    inline: true
                },
                {
                    name: lang === 'fr' ? 'Commandes' : 'Commands',
                    value: this.client.commands.size.toString(),
                    inline: true
                },
                {
                    name: lang === 'fr' ? 'Serveurs' : 'Servers',
                    value: this.client.guilds.cache.size.toString(),
                    inline: true
                }
            );

        await interaction.reply({ embeds: [embed] });
    }

    async handleProfileCommand(interaction, lang) {
        const user = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id);

        const embed = new EmbedBuilder()
            .setTitle(`${user.username} - ${lang === 'fr' ? 'Profil' : 'Profile'}`)
            .setThumbnail(user.displayAvatarURL())
            .setColor(member.displayHexColor)
            .addFields(
                {
                    name: lang === 'fr' ? 'Membre depuis' : 'Member since',
                    value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`,
                    inline: true
                },
                {
                    name: lang === 'fr' ? 'Compte créé' : 'Account created',
                    value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
                    inline: true
                }
            );

        // Ajouter les stats de modération si c'est l'utilisateur qui consulte son propre profil
        if (user.id === interaction.user.id) {
            const stats = await this.moderationSystem.getUserStats(user.id);
            if (stats) {
                embed.addFields({
                    name: lang === 'fr' ? 'Statistiques' : 'Statistics',
                    value: lang === 'fr'
                        ? `Avertissements: ${stats.warnings}\nMessages supprimés: ${stats.deletedMessages}`
                        : `Warnings: ${stats.warnings}\nDeleted messages: ${stats.deletedMessages}`
                });
            }
        }

        await interaction.reply({ embeds: [embed] });
    }

    async handleCrypterCommand(interaction, lang) {
        const file = interaction.options.getAttachment('file');
        const protection = interaction.options.getString('protection') || 'fivem_basic';
        const encoding = interaction.options.getString('encoding') || 'lua_metamorphic';
        const antiDebug = interaction.options.getString('anti_debug');
        const watermark = interaction.options.getBoolean('watermark') || false;

        // Vérification des permissions et abonnement
        const subscription = await this.accessManager.getUserSubscription(interaction.user.id);
        if (!subscription) {
            return await interaction.reply({
                content: lang === 'fr'
                    ? '❌ Vous devez avoir un abonnement pour utiliser cette fonctionnalité.'
                    : '❌ You need a subscription to use this feature.',
                ephemeral: true
            });
        }

        // Vérification des limites d'utilisation
        const usageCount = await this.accessManager.getUserDailyUsage(interaction.user.id);
        if (usageCount >= subscription.limit) {
            return await interaction.reply({
                content: lang === 'fr'
                    ? `❌ Vous avez atteint votre limite de ${subscription.limit} fichiers pour aujourd'hui.`
                    : `❌ You have reached your daily limit of ${subscription.limit} files.`,
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            // Vérification du type de fichier
            if (!file.name.endsWith('.lua')) {
                throw new Error('InvalidFileType');
            }

            // Téléchargement du fichier
            const response = await fetch(file.url);
            const fileContent = await response.text();

            // Configuration du cryptage selon le niveau choisi
            const obfuscator = new FSProtectObfuscator();
            const config = {
                fivem_basic: {
                    layers: 10,
                    preset: 'gaming'
                },
                fivem_pro: {
                    layers: 20,
                    preset: 'enterprise'
                },
                fivem_ultra: {
                    layers: 25,
                    preset: 'corporate'
                },
                fivem_quantum: {
                    layers: 30,
                    preset: 'military'
                }
            };

            // Application du cryptage
            const protectionConfig = config[protection];
            const obfuscated = await obfuscator.obfuscateFile(
                fileContent,
                file.name,
                protectionConfig.preset
            );

            // Création du fichier crypté
            const resultBuffer = Buffer.from(obfuscated, 'utf-8');
            const resultAttachment = new AttachmentBuilder(resultBuffer, {
                name: `${file.name.replace('.lua', '')}_protected.lua`
            });

            // Mise à jour du compteur d'utilisation
            await this.accessManager.incrementUserUsage(interaction.user.id);

            // Envoi du résultat
            await interaction.editReply({
                content: lang === 'fr'
                    ? `✅ Fichier crypté avec succès!\nProtection: ${protection}\nEncodage: ${encoding}\nAnti-Debug: ${antiDebug || 'Aucun'}\nWatermark: ${watermark ? 'Oui' : 'Non'}\nUtilisation: ${usageCount + 1}/${subscription.limit}`
                    : `✅ File successfully encrypted!\nProtection: ${protection}\nEncoding: ${encoding}\nAnti-Debug: ${antiDebug || 'None'}\nWatermark: ${watermark ? 'Yes' : 'No'}\nUsage: ${usageCount + 1}/${subscription.limit}`,
                files: [resultAttachment]
            });

        } catch (error) {
            console.error('Erreur cryptage:', error);
            let errorMessage = lang === 'fr'
                ? '❌ Une erreur est survenue lors du cryptage.'
                : '❌ An error occurred during encryption.';

            if (error.message === 'InvalidFileType') {
                errorMessage = lang === 'fr'
                    ? '❌ Seuls les fichiers Lua (.lua) sont acceptés.'
                    : '❌ Only Lua files (.lua) are accepted.';
            }

            await interaction.editReply({ content: errorMessage });
        }
    }

    // Utilitaires
    formatUptime(uptime) {
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime % 86400 / 3600);
        const minutes = Math.floor(uptime % 3600 / 60);
        return `${days}j ${hours}h ${minutes}m`;
    }

    // Démarrage et arrêt
    async start() {
        try {
            const config = require('./config.json');
            if (!config.bot?.token) {
                throw new Error('Token du bot manquant dans config.json');
            }

            await this.client.login(config.bot.token);

            // Configuration de la présence du bot
            this.client.user.setPresence({
                status: config.bot.presence.status,
                activities: [{
                    name: config.bot.presence.activity.name,
                    type: config.bot.presence.activity.type
                }]
            });

            // Enregistrement des commandes slash
            const commandsToRegister = Array.from(this.client.commands.values())
                .map(cmd => cmd.data);

            if (config.bot.guildId) {
                // Enregistrement des commandes pour un serveur spécifique (plus rapide pour le développement)
                const guild = await this.client.guilds.fetch(config.bot.guildId);
                await guild.commands.set(commandsToRegister);
                console.log(`✅ Commandes enregistrées pour le serveur ${guild.name}`);
            } else {
                // Enregistrement global des commandes
                await this.client.application?.commands.set(commandsToRegister);
                console.log('✅ Commandes enregistrées globalement');
            }
            
            console.log('✅ Bot démarré avec succès');
            
        } catch (error) {
            console.error('❌ Erreur lors du démarrage:', error);
            process.exit(1);
        }
    }

    async shutdown() {
        console.log('🛑 Arrêt du bot en cours...');
        try {
            await this.backupSystem.createBackup('shutdown');
        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
        }
        await this.client.destroy();
        console.log('✅ Bot arrêté proprement');
        process.exit(0);
    }
}

// Gestion des signaux
const bot = new FSProtectBot();
process.on('SIGINT', () => bot.shutdown());
process.on('SIGTERM', () => bot.shutdown());

// Démarrage
bot.start().catch(console.error);

module.exports = FSProtectBot;