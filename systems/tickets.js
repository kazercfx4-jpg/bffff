const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits 
} = require('discord.js');
const fs = require('fs');
const crypto = require('crypto');

class TicketSystem {
    constructor() {
        this.tickets = new Map();
        this.transcripts = new Map();
        this.categories = new Map();
        this.agents = new Map();
        this.stats = {
            totalTickets: 0,
            openTickets: 0,
            closedTickets: 0,
            avgResponseTime: 0,
            avgResolutionTime: 0
        };
        
        this.dataPath = './data/tickets.json';
        this.transcriptsPath = './data/transcripts/';
        this.loadData();
        
        // Configuration des priorités
        this.priorities = {
            low: { name: 'Faible', color: 0x00ff00, emoji: '🟢' },
            normal: { name: 'Normale', color: 0xffff00, emoji: '🟡' },
            high: { name: 'Élevée', color: 0xff9900, emoji: '🟠' },
            critical: { name: 'Critique', color: 0xff0000, emoji: '🔴' }
        };
        
        // Configuration des catégories
        this.ticketCategories = {
            technical: { name: 'Support Technique', emoji: '🔧' },
            obfuscation: { name: 'Problème Obfuscation', emoji: '🔒' },
            billing: { name: 'Facturation/Accès', emoji: '💳' },
            general: { name: 'Question Générale', emoji: '❓' },
            bug: { name: 'Rapport de Bug', emoji: '🐛' },
            feature: { name: 'Demande de Fonctionnalité', emoji: '💡' }
        };
    }

    async initialize() {
        // Créer le dossier transcripts s'il n'existe pas
        if (!fs.existsSync(this.transcriptsPath)) {
            fs.mkdirSync(this.transcriptsPath, { recursive: true });
        }
        
        console.log('🎫 Système de tickets initialisé');
    }

    // ===============================
    // CRÉATION DE TICKETS
    // ===============================

    async createTicket(interaction, reason, priority = 'normal', category = 'general') {
        const guild = interaction.guild;
        const user = interaction.user;
        const ticketId = this.generateTicketId();
        
        try {
            // Vérifier si l'utilisateur a déjà un ticket ouvert
            const existingTicket = this.getUserActiveTicket(user.id);
            if (existingTicket) {
                const embed = new EmbedBuilder()
                    .setTitle('⚠️ Ticket Existant')
                    .setDescription(`Vous avez déjà un ticket ouvert: <#${existingTicket.channelId}>`)
                    .setColor(0xff9900);
                
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Créer le canal de ticket
            const ticketChannel = await guild.channels.create({
                name: `ticket-${ticketId}`,
                type: ChannelType.GuildText,
                parent: this.getTicketCategoryId(guild.id),
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    },
                    ...this.getSupportRolePermissions(guild)
                ],
                topic: `Ticket #${ticketId} - ${user.tag} - ${this.ticketCategories[category]?.name || 'Support'}`
            });

            // Créer l'objet ticket
            const ticket = {
                id: ticketId,
                userId: user.id,
                userTag: user.tag,
                channelId: ticketChannel.id,
                guildId: guild.id,
                reason: reason,
                priority: priority,
                category: category,
                status: 'open',
                createdAt: new Date(),
                updatedAt: new Date(),
                messages: [],
                participants: new Set([user.id]),
                assignedTo: null,
                claimedBy: null,
                claimedAt: null,
                firstResponseAt: null,
                closedAt: null,
                closedBy: null,
                closeReason: null,
                rating: null,
                feedback: null,
                escalated: false,
                escalatedAt: null,
                tags: []
            };

            this.tickets.set(ticketId, ticket);
            this.stats.totalTickets++;
            this.stats.openTickets++;
            this.saveData();

            // Embed de bienvenue
            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`🎫 Ticket #${ticketId}`)
                .setDescription(`Bienvenue ${user}! Votre ticket FSProtect a été créé.`)
                .addFields(
                    { 
                        name: '📋 Informations', 
                        value: `**Raison:** ${reason}\n**Priorité:** ${this.priorities[priority].emoji} ${this.priorities[priority].name}\n**Catégorie:** ${this.ticketCategories[category]?.emoji} ${this.ticketCategories[category]?.name}`,
                        inline: false 
                    },
                    { name: '📅 Créé le', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                    { name: '🆔 ID Ticket', value: ticketId, inline: true },
                    { name: '⏱️ Statut', value: '🟢 Ouvert', inline: true }
                )
                .setColor(this.priorities[priority].color)
                .setFooter({ 
                    text: 'FSProtect Support • Un agent vous répondra bientôt',
                    iconURL: guild.iconURL()
                })
                .setTimestamp();

            // Boutons d'action
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ticket_close_${ticketId}`)
                        .setLabel('Fermer le ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒'),
                    new ButtonBuilder()
                        .setCustomId(`ticket_priority_${ticketId}`)
                        .setLabel('Changer priorité')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⚡'),
                    new ButtonBuilder()
                        .setCustomId(`ticket_transcript_${ticketId}`)
                        .setLabel('Transcript')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📄')
                );

            await ticketChannel.send({ 
                content: `${user} ${this.getSupportRoleMention(guild)}`,
                embeds: [welcomeEmbed], 
                components: [actionRow] 
            });

            // Message d'instructions
            const instructionsEmbed = new EmbedBuilder()
                .setTitle('📖 Instructions')
                .setDescription('**Comment utiliser ce ticket:**')
                .addFields(
                    { 
                        name: '💬 Communication', 
                        value: '• Décrivez votre problème en détail\n• Joignez des captures d\'écran si nécessaire\n• Soyez patient, un agent vous répondra', 
                        inline: false 
                    },
                    { 
                        name: '🔧 Actions disponibles', 
                        value: '• 🔒 Fermer le ticket quand résolu\n• ⚡ Changer la priorité si urgent\n• 📄 Télécharger le transcript', 
                        inline: false 
                    },
                    { 
                        name: '⚠️ Règles', 
                        value: '• Restez respectueux\n• Pas de spam\n• Un seul problème par ticket', 
                        inline: false 
                    }
                )
                .setColor(0x0099ff)
                .setFooter({ text: 'FSProtect Support System' });

            await ticketChannel.send({ embeds: [instructionsEmbed] });

            // Notifier dans le canal de logs
            await this.logTicketAction('TICKET_CREATED', ticket);

            // Réponse à l'interaction
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Ticket Créé')
                .setDescription(`Votre ticket a été créé: ${ticketChannel}`)
                .setColor(0x00ff00);

            await interaction.reply({ embeds: [successEmbed], ephemeral: true });

            return { ticket, channel: ticketChannel };

        } catch (error) {
            console.error('Erreur création ticket:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erreur')
                .setDescription('Impossible de créer le ticket. Contactez un administrateur.')
                .setColor(0xff0000);

            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            return null;
        }
    }

    // ===============================
    // GESTION DES TICKETS
    // ===============================

    async claimTicket(interaction, ticketId) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) {
            return interaction.reply({ content: '❌ Ticket non trouvé.', ephemeral: true });
        }

        if (ticket.status !== 'open') {
            return interaction.reply({ content: '❌ Ce ticket n\'est pas ouvert.', ephemeral: true });
        }

        if (ticket.claimedBy) {
            const claimedUser = interaction.guild.members.cache.get(ticket.claimedBy);
            return interaction.reply({ 
                content: `❌ Ce ticket est déjà pris en charge par ${claimedUser?.user.tag || 'un agent'}.`, 
                ephemeral: true 
            });
        }

        // Claim du ticket
        ticket.claimedBy = interaction.user.id;
        ticket.claimedAt = new Date();
        ticket.assignedTo = interaction.user.id;
        ticket.updatedAt = new Date();

        // Si c'est la première réponse
        if (!ticket.firstResponseAt) {
            ticket.firstResponseAt = new Date();
        }

        this.saveData();

        // Embed de claim
        const claimEmbed = new EmbedBuilder()
            .setTitle('👤 Ticket Pris en Charge')
            .setDescription(`${interaction.user} a pris en charge ce ticket.`)
            .addFields(
                { name: '🎫 Ticket', value: `#${ticketId}`, inline: true },
                { name: '👤 Agent', value: interaction.user.tag, inline: true },
                { name: '⏰ Pris en charge le', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            )
            .setColor(0x0099ff)
            .setTimestamp();

        const channel = interaction.guild.channels.cache.get(ticket.channelId);
        if (channel) {
            await channel.send({ embeds: [claimEmbed] });
        }

        await this.logTicketAction('TICKET_CLAIMED', ticket, { agent: interaction.user.tag });
        await interaction.reply({ content: '✅ Vous avez pris en charge ce ticket.', ephemeral: true });
    }

    async closeTicket(interaction, ticketId, reason = 'Résolu') {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) {
            return interaction.reply({ content: '❌ Ticket non trouvé.', ephemeral: true });
        }

        if (ticket.status === 'closed') {
            return interaction.reply({ content: '❌ Ce ticket est déjà fermé.', ephemeral: true });
        }

        // Vérifier les permissions
        const canClose = ticket.userId === interaction.user.id || 
                        this.hasStaffPermissions(interaction.member);

        if (!canClose) {
            return interaction.reply({ content: '❌ Vous n\'avez pas la permission de fermer ce ticket.', ephemeral: true });
        }

        // Générer le transcript
        const transcriptPath = await this.generateTranscript(ticket);

        // Mettre à jour le ticket
        ticket.status = 'closed';
        ticket.closedAt = new Date();
        ticket.closedBy = interaction.user.id;
        ticket.closeReason = reason;
        ticket.updatedAt = new Date();

        this.stats.openTickets--;
        this.stats.closedTickets++;
        this.saveData();

        // Embed de fermeture
        const closeEmbed = new EmbedBuilder()
            .setTitle('🔒 Ticket Fermé')
            .setDescription(`Ce ticket a été fermé par ${interaction.user}.`)
            .addFields(
                { name: '📋 Raison', value: reason, inline: true },
                { name: '⏰ Fermé le', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: '📄 Transcript', value: transcriptPath ? 'Généré' : 'Non disponible', inline: true }
            )
            .setColor(0xff0000)
            .setTimestamp();

        const channel = interaction.guild.channels.cache.get(ticket.channelId);
        if (channel) {
            await channel.send({ embeds: [closeEmbed] });
            
            // Bouton de satisfaction si c'est l'utilisateur qui ferme
            if (ticket.userId === interaction.user.id) {
                const feedbackRow = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`ticket_rating_${ticketId}`)
                            .setPlaceholder('Évaluez notre support (optionnel)')
                            .addOptions([
                                { label: '⭐ Très mauvais', value: '1' },
                                { label: '⭐⭐ Mauvais', value: '2' },
                                { label: '⭐⭐⭐ Correct', value: '3' },
                                { label: '⭐⭐⭐⭐ Bon', value: '4' },
                                { label: '⭐⭐⭐⭐⭐ Excellent', value: '5' }
                            ])
                    );
                
                await channel.send({ 
                    content: 'Merci d\'avoir utilisé notre support ! Votre avis nous aide à nous améliorer.',
                    components: [feedbackRow] 
                });
            }
            
            // Programmer la suppression du canal après 24h
            setTimeout(async () => {
                try {
                    const channelToDelete = interaction.guild.channels.cache.get(ticket.channelId);
                    if (channelToDelete) {
                        await channelToDelete.delete('Ticket fermé depuis 24h');
                    }
                } catch (error) {
                    console.error('Erreur suppression canal ticket:', error);
                }
            }, 24 * 60 * 60 * 1000);
        }

        await this.logTicketAction('TICKET_CLOSED', ticket, { reason, closedBy: interaction.user.tag });
        await interaction.reply({ content: '✅ Ticket fermé avec succès.', ephemeral: true });
    }

    async escalateTicket(interaction, ticketId, reason = '') {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) {
            return interaction.reply({ content: '❌ Ticket non trouvé.', ephemeral: true });
        }

        if (ticket.escalated) {
            return interaction.reply({ content: '❌ Ce ticket est déjà escaladé.', ephemeral: true });
        }

        ticket.escalated = true;
        ticket.escalatedAt = new Date();
        ticket.priority = 'critical';
        ticket.updatedAt = new Date();

        this.saveData();

        const escalateEmbed = new EmbedBuilder()
            .setTitle('🚨 Ticket Escaladé')
            .setDescription(`Ce ticket a été escaladé par ${interaction.user}.`)
            .addFields(
                { name: '📋 Raison', value: reason || 'Non spécifiée', inline: true },
                { name: '⚡ Nouvelle priorité', value: '🔴 Critique', inline: true },
                { name: '⏰ Escaladé le', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            )
            .setColor(0xff0000)
            .setTimestamp();

        const channel = interaction.guild.channels.cache.get(ticket.channelId);
        if (channel) {
            await channel.send({ 
                content: '@here Ticket escaladé - Attention requise',
                embeds: [escalateEmbed] 
            });
        }

        await this.logTicketAction('TICKET_ESCALATED', ticket, { reason, escalatedBy: interaction.user.tag });
        await interaction.reply({ content: '🚨 Ticket escaladé avec succès.', ephemeral: true });
    }

    // ===============================
    // SYSTÈME DE TRANSCRIPTS
    // ===============================

    async generateTranscript(ticket) {
        try {
            const channel = ticket.channelId;
            const guild = ticket.guildId;
            
            // Récupérer les messages du canal
            const messages = ticket.messages || [];
            
            // Générer le HTML du transcript
            const transcriptHtml = this.buildTranscriptHtml(ticket, messages);
            
            // Sauvegarder le transcript
            const filename = `transcript_${ticket.id}_${Date.now()}.html`;
            const filepath = this.transcriptsPath + filename;
            
            fs.writeFileSync(filepath, transcriptHtml);
            
            // Sauvegarder dans la base
            this.transcripts.set(ticket.id, {
                ticketId: ticket.id,
                filename: filename,
                filepath: filepath,
                createdAt: new Date(),
                messageCount: messages.length
            });
            
            return filepath;
        } catch (error) {
            console.error('Erreur génération transcript:', error);
            return null;
        }
    }

    buildTranscriptHtml(ticket, messages) {
        const priorityInfo = this.priorities[ticket.priority];
        const categoryInfo = this.ticketCategories[ticket.category];
        
        return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transcript Ticket #${ticket.id}</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #36393f; color: #dcddde; margin: 0; padding: 20px; }
        .header { background: #2f3136; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .ticket-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .info-card { background: #40444b; padding: 15px; border-radius: 8px; }
        .info-card h3 { margin: 0 0 10px 0; color: #ffffff; }
        .messages { background: #40444b; border-radius: 8px; padding: 20px; }
        .message { margin-bottom: 15px; padding: 10px; background: #36393f; border-radius: 6px; }
        .message-header { display: flex; align-items: center; margin-bottom: 8px; }
        .avatar { width: 24px; height: 24px; border-radius: 50%; margin-right: 10px; background: #7289da; }
        .username { font-weight: bold; color: #ffffff; }
        .timestamp { color: #72767d; font-size: 0.8em; margin-left: auto; }
        .message-content { line-height: 1.4; }
        .priority-${ticket.priority} { border-left: 4px solid ${priorityInfo.color.toString(16)}; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📄 Transcript Ticket #${ticket.id}</h1>
        <p>Généré le ${new Date().toLocaleString('fr-FR')}</p>
    </div>
    
    <div class="ticket-info">
        <div class="info-card">
            <h3>🎫 Informations Ticket</h3>
            <p><strong>ID:</strong> ${ticket.id}</p>
            <p><strong>Statut:</strong> ${ticket.status}</p>
            <p><strong>Créé le:</strong> ${ticket.createdAt.toLocaleString('fr-FR')}</p>
        </div>
        
        <div class="info-card">
            <h3>👤 Utilisateur</h3>
            <p><strong>Tag:</strong> ${ticket.userTag}</p>
            <p><strong>ID:</strong> ${ticket.userId}</p>
        </div>
        
        <div class="info-card">
            <h3>📋 Détails</h3>
            <p><strong>Raison:</strong> ${ticket.reason}</p>
            <p><strong>Priorité:</strong> ${priorityInfo.emoji} ${priorityInfo.name}</p>
            <p><strong>Catégorie:</strong> ${categoryInfo?.emoji} ${categoryInfo?.name}</p>
        </div>
        
        <div class="info-card">
            <h3>🎯 Support</h3>
            <p><strong>Assigné à:</strong> ${ticket.assignedTo || 'Non assigné'}</p>
            <p><strong>Première réponse:</strong> ${ticket.firstResponseAt ? ticket.firstResponseAt.toLocaleString('fr-FR') : 'Aucune'}</p>
            ${ticket.closedAt ? `<p><strong>Fermé le:</strong> ${ticket.closedAt.toLocaleString('fr-FR')}</p>` : ''}
        </div>
    </div>
    
    <div class="messages">
        <h2>💬 Messages</h2>
        ${messages.map(msg => `
            <div class="message">
                <div class="message-header">
                    <div class="avatar"></div>
                    <span class="username">${msg.author}</span>
                    <span class="timestamp">${new Date(msg.timestamp).toLocaleString('fr-FR')}</span>
                </div>
                <div class="message-content">${msg.content}</div>
                ${msg.attachments ? msg.attachments.map(att => `<p>📎 <a href="${att.url}">${att.name}</a></p>`).join('') : ''}
            </div>
        `).join('')}
    </div>
    
    <div class="footer" style="margin-top: 30px; text-align: center; color: #72767d;">
        <p>FSProtect Support System - Transcript généré automatiquement</p>
    </div>
</body>
</html>`;
    }

    // ===============================
    // GESTION DES MESSAGES
    // ===============================

    addMessage(ticketId, message) {
        const ticket = this.tickets.get(ticketId);
        if (!ticket) return;

        const messageData = {
            id: message.id,
            author: message.author.tag,
            authorId: message.author.id,
            content: message.content,
            timestamp: new Date(message.createdTimestamp),
            attachments: message.attachments.map(att => ({
                name: att.name,
                url: att.url,
                size: att.size
            })),
            embeds: message.embeds.length > 0
        };

        ticket.messages.push(messageData);
        ticket.participants.add(message.author.id);
        ticket.updatedAt = new Date();

        this.saveData();
    }

    // ===============================
    // STATISTIQUES ET RAPPORTS
    // ===============================

    getStats() {
        const tickets = Array.from(this.tickets.values());
        const now = new Date();
        const dayMs = 24 * 60 * 60 * 1000;
        
        return {
            total: tickets.length,
            open: tickets.filter(t => t.status === 'open').length,
            closed: tickets.filter(t => t.status === 'closed').length,
            escalated: tickets.filter(t => t.escalated).length,
            
            // Statistiques temporelles
            today: tickets.filter(t => now - t.createdAt < dayMs).length,
            thisWeek: tickets.filter(t => now - t.createdAt < 7 * dayMs).length,
            thisMonth: tickets.filter(t => now - t.createdAt < 30 * dayMs).length,
            
            // Répartition par priorité
            byPriority: {
                low: tickets.filter(t => t.priority === 'low').length,
                normal: tickets.filter(t => t.priority === 'normal').length,
                high: tickets.filter(t => t.priority === 'high').length,
                critical: tickets.filter(t => t.priority === 'critical').length
            },
            
            // Répartition par catégorie
            byCategory: Object.keys(this.ticketCategories).reduce((acc, cat) => {
                acc[cat] = tickets.filter(t => t.category === cat).length;
                return acc;
            }, {}),
            
            // Temps de réponse moyen
            avgResponseTime: this.calculateAverageResponseTime(tickets),
            avgResolutionTime: this.calculateAverageResolutionTime(tickets)
        };
    }

    calculateAverageResponseTime(tickets) {
        const responded = tickets.filter(t => t.firstResponseAt);
        if (responded.length === 0) return 0;
        
        const totalTime = responded.reduce((sum, ticket) => {
            return sum + (ticket.firstResponseAt - ticket.createdAt);
        }, 0);
        
        return Math.round(totalTime / responded.length / 1000 / 60); // en minutes
    }

    calculateAverageResolutionTime(tickets) {
        const closed = tickets.filter(t => t.closedAt);
        if (closed.length === 0) return 0;
        
        const totalTime = closed.reduce((sum, ticket) => {
            return sum + (ticket.closedAt - ticket.createdAt);
        }, 0);
        
        return Math.round(totalTime / closed.length / 1000 / 60 / 60); // en heures
    }

    // ===============================
    // UTILITAIRES
    // ===============================

    generateTicketId() {
        return Math.random().toString(36).substr(2, 8).toUpperCase();
    }

    getUserActiveTicket(userId) {
        return Array.from(this.tickets.values()).find(
            ticket => ticket.userId === userId && ticket.status === 'open'
        );
    }

    getTicketByChannel(channelId) {
        return Array.from(this.tickets.values()).find(
            ticket => ticket.channelId === channelId
        );
    }

    hasStaffPermissions(member) {
        return member.permissions.has(PermissionFlagsBits.ManageMessages) ||
               member.roles.cache.some(role => 
                   role.name.toLowerCase().includes('support') ||
                   role.name.toLowerCase().includes('staff') ||
                   role.name.toLowerCase().includes('admin')
               );
    }

    getTicketCategoryId(guildId) {
        // TODO: Récupérer depuis la config du serveur
        return null;
    }

    getSupportRolePermissions(guild) {
        const supportRoles = guild.roles.cache.filter(role => 
            role.name.toLowerCase().includes('support') ||
            role.name.toLowerCase().includes('staff')
        );

        return supportRoles.map(role => ({
            id: role.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks
            ]
        }));
    }

    getSupportRoleMention(guild) {
        const supportRole = guild.roles.cache.find(role => 
            role.name.toLowerCase().includes('support')
        );
        return supportRole ? supportRole.toString() : '';
    }

    async logTicketAction(action, ticket, metadata = {}) {
        // TODO: Envoyer dans le canal de logs si configuré
        console.log(`[TICKET] ${action} - Ticket #${ticket.id}`, metadata);
    }

    // ===============================
    // SAUVEGARDE ET CHARGEMENT
    // ===============================

    saveData() {
        try {
            const data = {
                tickets: Array.from(this.tickets.entries()).map(([id, ticket]) => [
                    id,
                    {
                        ...ticket,
                        participants: Array.from(ticket.participants),
                        createdAt: ticket.createdAt.toISOString(),
                        updatedAt: ticket.updatedAt.toISOString(),
                        claimedAt: ticket.claimedAt ? ticket.claimedAt.toISOString() : null,
                        firstResponseAt: ticket.firstResponseAt ? ticket.firstResponseAt.toISOString() : null,
                        closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
                        escalatedAt: ticket.escalatedAt ? ticket.escalatedAt.toISOString() : null
                    }
                ]),
                stats: this.stats
            };
            fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Erreur sauvegarde tickets:', error);
        }
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataPath)) {
                const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
                this.tickets = new Map(data.tickets?.map(([id, ticket]) => [
                    id,
                    {
                        ...ticket,
                        participants: new Set(ticket.participants),
                        createdAt: new Date(ticket.createdAt),
                        updatedAt: new Date(ticket.updatedAt),
                        claimedAt: ticket.claimedAt ? new Date(ticket.claimedAt) : null,
                        firstResponseAt: ticket.firstResponseAt ? new Date(ticket.firstResponseAt) : null,
                        closedAt: ticket.closedAt ? new Date(ticket.closedAt) : null,
                        escalatedAt: ticket.escalatedAt ? new Date(ticket.escalatedAt) : null
                    }
                ]) || []);
                this.stats = data.stats || this.stats;
            }
        } catch (error) {
            console.error('Erreur chargement tickets:', error);
        }
    }
}

module.exports = TicketSystem;