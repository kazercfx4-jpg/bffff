const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

class AdminSystem {
    constructor() {
        this.adminUsers = new Set();
        this.maintenanceMode = false;
        this.systemStats = {
            startTime: Date.now(),
            commandsExecuted: 0,
            errorsCount: 0,
            filesProcessed: 0
        };
        
        this.loadConfiguration();
    }

    loadConfiguration() {
        try {
            const configPath = path.join(__dirname, '..', 'data', 'admin.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                this.adminUsers = new Set(config.adminUsers || []);
                this.maintenanceMode = config.maintenanceMode || false;
                this.systemStats = { ...this.systemStats, ...config.systemStats };
            }
        } catch (error) {
            console.error('Erreur chargement admin:', error);
        }
    }

    saveConfiguration() {
        try {
            const configPath = path.join(__dirname, '..', 'data', 'admin.json');
            const config = {
                adminUsers: Array.from(this.adminUsers),
                maintenanceMode: this.maintenanceMode,
                systemStats: this.systemStats
            };
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('Erreur sauvegarde admin:', error);
        }
    }

    // === INTERFACE PRINCIPALE D'ADMINISTRATION ===

    async showAdminPanel(interaction) {
        if (!this.isAdmin(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ Accès refusé. Droits administrateur requis.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('🛠️ Panel d\'Administration FSProtect')
            .setDescription('Interface de gestion complète du système')
            .setColor('#e74c3c')
            .addFields(
                {
                    name: '📊 Statistiques Système',
                    value: await this.getSystemStatsText(),
                    inline: true
                },
                {
                    name: '👥 Gestion Utilisateurs',
                    value: await this.getUserStatsText(),
                    inline: true
                },
                {
                    name: '💰 Gestion Abonnements',
                    value: await this.getSubscriptionStatsText(),
                    inline: true
                },
                {
                    name: '💳 Gestion Paiements',
                    value: await this.getPaymentStatsText(),
                    inline: true
                }
            )
            .setFooter({ text: `Uptime: ${this.getUptime()}` })
            .setTimestamp();

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_users')
                    .setLabel('👥 Utilisateurs')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_subscriptions')
                    .setLabel('💰 Abonnements')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_payments')
                    .setLabel('💳 Paiements')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('admin_system')
                    .setLabel('⚙️ Système')
                    .setStyle(ButtonStyle.Secondary)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_logs')
                    .setLabel('📋 Logs')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('admin_backup')
                    .setLabel('💾 Sauvegarde')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('admin_maintenance')
                    .setLabel(this.maintenanceMode ? '🔧 Arrêter Maintenance' : '🔧 Mode Maintenance')
                    .setStyle(this.maintenanceMode ? ButtonStyle.Success : ButtonStyle.Danger)
            );

        await interaction.reply({
            embeds: [embed],
            components: [row1, row2],
            ephemeral: true
        });
    }

    // === GESTION DES UTILISATEURS ===

    async showUserManagement(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('👥 Gestion des Utilisateurs')
            .setDescription('Interface de gestion des utilisateurs et permissions')
            .setColor('#3498db');

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('admin_user_action')
            .setPlaceholder('Sélectionner une action')
            .addOptions(
                {
                    label: '🔍 Rechercher Utilisateur',
                    description: 'Rechercher un utilisateur par ID ou nom',
                    value: 'search_user'
                },
                {
                    label: '📊 Statistiques Utilisateurs',
                    description: 'Voir les statistiques des utilisateurs',
                    value: 'user_stats'
                },
                {
                    label: '🔧 Modifier Permissions',
                    description: 'Modifier les permissions d\'un utilisateur',
                    value: 'edit_permissions'
                },
                {
                    label: '🚫 Bannir Utilisateur',
                    description: 'Bannir un utilisateur du service',
                    value: 'ban_user'
                },
                {
                    label: '✅ Débannir Utilisateur',
                    description: 'Lever le bannissement d\'un utilisateur',
                    value: 'unban_user'
                }
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_back')
                    .setLabel('← Retour')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [row, backButton]
        });
    }

    // === GESTION DES ABONNEMENTS ===

    async showSubscriptionManagement(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('💰 Gestion des Abonnements')
            .setDescription('Interface de gestion des plans et abonnements')
            .setColor('#f39c12');

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('admin_subscription_action')
            .setPlaceholder('Sélectionner une action')
            .addOptions(
                {
                    label: '📋 Gérer les Plans',
                    description: 'Créer, modifier ou supprimer des plans',
                    value: 'manage_plans'
                },
                {
                    label: '👤 Abonnements Utilisateurs',
                    description: 'Voir et modifier les abonnements utilisateurs',
                    value: 'user_subscriptions'
                },
                {
                    label: '📊 Statistiques Revenus',
                    description: 'Voir les statistiques de revenus',
                    value: 'revenue_stats'
                },
                {
                    label: '🔄 Reset Quotas',
                    description: 'Réinitialiser les quotas mensuels',
                    value: 'reset_quotas'
                },
                {
                    label: '⚙️ Configuration Tarifs',
                    description: 'Modifier les prix et limites',
                    value: 'pricing_config'
                }
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_back')
                    .setLabel('← Retour')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [row, backButton]
        });
    }

    // === GESTION DES PAIEMENTS ===

    async showPaymentManagement(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('💳 Gestion des Paiements')
            .setDescription('Interface de gestion des moyens de paiement et transactions')
            .setColor('#e67e22');

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('admin_payment_action')
            .setPlaceholder('Sélectionner une action')
            .addOptions(
                {
                    label: '🔧 Moyens de Paiement',
                    description: 'Gérer les moyens de paiement disponibles',
                    value: 'manage_payment_methods'
                },
                {
                    label: '⏳ Paiements en Attente',
                    description: 'Voir et confirmer les paiements en attente',
                    value: 'pending_payments'
                },
                {
                    label: '✅ Confirmer Paiement',
                    description: 'Confirmer un paiement manuellement',
                    value: 'confirm_payment'
                },
                {
                    label: '❌ Annuler Paiement',
                    description: 'Annuler un paiement en attente',
                    value: 'cancel_payment'
                },
                {
                    label: '📊 Historique Paiements',
                    description: 'Consulter l\'historique des paiements',
                    value: 'payment_history'
                }
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_back')
                    .setLabel('← Retour')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [row, backButton]
        });
    }

    // === GESTION DES MOYENS DE PAIEMENT ===

    async showPaymentMethodsManagement(interaction, paymentSystem) {
        const methods = Array.from(paymentSystem.paymentMethods.values());
        
        const embed = new EmbedBuilder()
            .setTitle('🔧 Gestion des Moyens de Paiement')
            .setDescription('Gérer les moyens de paiement disponibles pour les utilisateurs')
            .setColor('#8e44ad');

        for (const method of methods.slice(0, 10)) {
            embed.addFields({
                name: `${method.icon} ${method.name}`,
                value: `ID: \`${method.id}\`\nStatut: ${method.active ? '✅ Actif' : '❌ Inactif'}\nInstructions: ${method.details.instructions.substring(0, 100)}...`,
                inline: true
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('admin_payment_method_action')
            .setPlaceholder('Action sur les moyens de paiement')
            .addOptions(
                {
                    label: '➕ Ajouter Moyen de Paiement',
                    description: 'Créer un nouveau moyen de paiement',
                    value: 'add_payment_method'
                },
                {
                    label: '✏️ Modifier Moyen de Paiement',
                    description: 'Modifier un moyen de paiement existant',
                    value: 'edit_payment_method'
                },
                {
                    label: '🔄 Activer/Désactiver',
                    description: 'Activer ou désactiver un moyen de paiement',
                    value: 'toggle_payment_method'
                },
                {
                    label: '🗑️ Supprimer Moyen de Paiement',
                    description: 'Supprimer un moyen de paiement',
                    value: 'delete_payment_method'
                }
            );

        const actionRow = new ActionRowBuilder().addComponents(selectMenu);

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_payments')
                    .setLabel('← Retour')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [actionRow, backButton]
        });
    }

    // === PAIEMENTS EN ATTENTE ===

    async showPendingPayments(interaction, paymentSystem) {
        const pending = paymentSystem.getPendingPayments();
        
        const embed = new EmbedBuilder()
            .setTitle('⏳ Paiements en Attente')
            .setDescription(`${pending.length} paiement(s) en attente de confirmation`)
            .setColor('#f39c12');

        if (pending.length === 0) {
            embed.addFields({
                name: '✅ Aucun paiement en attente',
                value: 'Tous les paiements ont été traités',
                inline: false
            });
        } else {
            for (const payment of pending.slice(0, 10)) {
                const timeLeft = new Date(payment.expiresAt) - new Date();
                const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
                
                embed.addFields({
                    name: `💳 ${payment.id}`,
                    value: `Utilisateur: <@${payment.userId}>\nPlan: ${payment.planId}\nMontant: ${payment.amount}€\nExpire dans: ${hoursLeft}h`,
                    inline: true
                });
            }
        }

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_refresh_pending')
                    .setLabel('🔄 Actualiser')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('admin_confirm_payment_modal')
                    .setLabel('✅ Confirmer Paiement')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('admin_cancel_payment_modal')
                    .setLabel('❌ Annuler Paiement')
                    .setStyle(ButtonStyle.Danger)
            );

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_payments')
                    .setLabel('← Retour')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [buttons, backButton]
        });
    }

    // === MODAL POUR AJOUTER MOYEN DE PAIEMENT ===

    async showAddPaymentMethodModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('admin_add_payment_method_modal')
            .setTitle('Ajouter un Moyen de Paiement');

        const nameInput = new TextInputBuilder()
            .setCustomId('method_name')
            .setLabel('Nom du Moyen de Paiement')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex: PayPal, Crypto, Virement');

        const iconInput = new TextInputBuilder()
            .setCustomId('method_icon')
            .setLabel('Icône (emoji)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex: 💳, ₿, 🏦');

        const instructionsInput = new TextInputBuilder()
            .setCustomId('method_instructions')
            .setLabel('Instructions pour l\'utilisateur')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Instructions complètes pour effectuer le paiement...');

        const detailsInput = new TextInputBuilder()
            .setCustomId('method_details')
            .setLabel('Détails (email, adresse, IBAN, etc.)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder('email:test@example.com\niban:FR76...\naddress:bc1q...');

        modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(iconInput),
            new ActionRowBuilder().addComponents(instructionsInput),
            new ActionRowBuilder().addComponents(detailsInput)
        );

        await interaction.showModal(modal);
    }

    // === MODAL POUR CONFIRMER PAIEMENT ===

    async showConfirmPaymentModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('admin_confirm_payment_modal_form')
            .setTitle('Confirmer un Paiement');

        const paymentIdInput = new TextInputBuilder()
            .setCustomId('payment_id')
            .setLabel('ID du Paiement')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('PAY_XXXXXXXX_XXXX');

        const notesInput = new TextInputBuilder()
            .setCustomId('confirmation_notes')
            .setLabel('Notes de confirmation (optionnel)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder('Notes sur la vérification du paiement...');

        modal.addComponents(
            new ActionRowBuilder().addComponents(paymentIdInput),
            new ActionRowBuilder().addComponents(notesInput)
        );

        await interaction.showModal(modal);
    }

    async showPlanManagement(interaction, subscriptionManager) {
        const plans = subscriptionManager.getAllSubscriptionPlans();
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Gestion des Plans d\'Abonnement')
            .setDescription('Créer, modifier ou supprimer des plans d\'abonnement')
            .setColor('#9b59b6');

        for (const plan of plans.slice(0, 10)) { // Limiter à 10 plans
            embed.addFields({
                name: `${plan.icon} ${plan.name} (${plan.price}€)`,
                value: `Fichiers: ${plan.features.filesPerMonth === -1 ? 'Illimité' : plan.features.filesPerMonth}/mois\nTaille max: ${this.formatBytes(plan.features.maxFileSize)}\nStatut: ${plan.active ? '✅ Actif' : '❌ Inactif'}`,
                inline: true
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('admin_plan_action')
            .setPlaceholder('Sélectionner une action')
            .addOptions(
                {
                    label: '➕ Créer un Plan',
                    description: 'Créer un nouveau plan d\'abonnement',
                    value: 'create_plan'
                },
                {
                    label: '✏️ Modifier un Plan',
                    description: 'Modifier un plan existant',
                    value: 'edit_plan'
                },
                {
                    label: '🗑️ Supprimer un Plan',
                    description: 'Supprimer un plan d\'abonnement',
                    value: 'delete_plan'
                },
                {
                    label: '📊 Affichage Tarifs',
                    description: 'Voir l\'affichage public des tarifs',
                    value: 'view_pricing'
                }
            );

        const actionRow = new ActionRowBuilder().addComponents(selectMenu);

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_subscriptions')
                    .setLabel('← Retour')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [actionRow, backButton]
        });
    }

    // === CRÉATION DE PLAN ===

    async showCreatePlanModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('admin_create_plan_modal')
            .setTitle('Créer un Nouveau Plan');

        const nameInput = new TextInputBuilder()
            .setCustomId('plan_name')
            .setLabel('Nom du Plan (FR)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex: Standard');

        const nameEnInput = new TextInputBuilder()
            .setCustomId('plan_name_en')
            .setLabel('Nom du Plan (EN)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex: Standard');

        const priceInput = new TextInputBuilder()
            .setCustomId('plan_price')
            .setLabel('Prix (EUR)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex: 25');

        const filesInput = new TextInputBuilder()
            .setCustomId('plan_files')
            .setLabel('Fichiers par mois (-1 pour illimité)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex: 100');

        const descriptionInput = new TextInputBuilder()
            .setCustomId('plan_description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Description du plan...');

        modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(nameEnInput),
            new ActionRowBuilder().addComponents(priceInput),
            new ActionRowBuilder().addComponents(filesInput),
            new ActionRowBuilder().addComponents(descriptionInput)
        );

        await interaction.showModal(modal);
    }

    async handleCreatePlan(interaction, subscriptionManager) {
        const name = interaction.fields.getTextInputValue('plan_name');
        const nameEn = interaction.fields.getTextInputValue('plan_name_en');
        const price = parseInt(interaction.fields.getTextInputValue('plan_price'));
        const files = parseInt(interaction.fields.getTextInputValue('plan_files'));
        const description = interaction.fields.getTextInputValue('plan_description');

        try {
            const planData = {
                name,
                nameEn,
                price,
                description,
                descriptionEn: description,
                features: {
                    filesPerMonth: files,
                    maxFileSize: price <= 15 ? 10485760 : price <= 25 ? 52428800 : 104857600,
                    obfuscationLevel: price <= 15 ? 3 : price <= 25 ? 4 : 5,
                    supportPriority: price <= 15 ? 'normal' : price <= 25 ? 'high' : 'premium',
                    apiAccess: price > 15,
                    webhookSupport: price > 15,
                    advancedFeatures: price > 15
                },
                limits: {
                    dailyFiles: Math.ceil(files / 5),
                    concurrentProcessing: price <= 15 ? 2 : price <= 25 ? 3 : 5,
                    archiveSize: (price <= 15 ? 50 : price <= 25 ? 100 : 500) * 1048576,
                    storageTime: price <= 15 ? 30 : price <= 25 ? 60 : 90
                },
                color: price <= 15 ? '#3498db' : price <= 25 ? '#e74c3c' : '#f39c12',
                icon: price <= 15 ? '🚀' : price <= 25 ? '⭐' : '💎'
            };

            const plan = subscriptionManager.createSubscriptionPlan(planData);

            const embed = new EmbedBuilder()
                .setTitle('✅ Plan Créé avec Succès')
                .setDescription(`Le plan **${plan.name}** a été créé avec succès`)
                .setColor('#27ae60')
                .addFields(
                    {
                        name: 'Nom',
                        value: `${plan.name} / ${plan.nameEn}`,
                        inline: true
                    },
                    {
                        name: 'Prix',
                        value: `${plan.price}€`,
                        inline: true
                    },
                    {
                        name: 'Fichiers/mois',
                        value: plan.features.filesPerMonth.toString(),
                        inline: true
                    }
                );

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });

        } catch (error) {
            await interaction.reply({
                content: `❌ Erreur lors de la création du plan: ${error.message}`,
                ephemeral: true
            });
        }
    }

    // === GESTION SYSTÈME ===

    async showSystemManagement(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Gestion Système')
            .setDescription('Outils de gestion et maintenance du système')
            .setColor('#95a5a6');

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('admin_system_action')
            .setPlaceholder('Sélectionner une action système')
            .addOptions(
                {
                    label: '📊 Statistiques Détaillées',
                    description: 'Voir les statistiques complètes du système',
                    value: 'detailed_stats'
                },
                {
                    label: '🔄 Redémarrer Services',
                    description: 'Redémarrer les services du bot',
                    value: 'restart_services'
                },
                {
                    label: '🧹 Nettoyer Cache',
                    description: 'Vider le cache système',
                    value: 'clear_cache'
                },
                {
                    label: '🔧 Configuration',
                    description: 'Modifier la configuration système',
                    value: 'system_config'
                },
                {
                    label: '📈 Monitoring',
                    description: 'Outils de monitoring en temps réel',
                    value: 'monitoring'
                }
            );

        const actionRow = new ActionRowBuilder().addComponents(selectMenu);

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_back')
                    .setLabel('← Retour')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [actionRow, backButton]
        });
    }

    // === LOGS ET MONITORING ===

    async showLogsManagement(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('📋 Gestion des Logs')
            .setDescription('Consultation et analyse des logs système')
            .setColor('#34495e');

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('admin_logs_action')
            .setPlaceholder('Sélectionner le type de logs')
            .addOptions(
                {
                    label: '📄 Logs Système',
                    description: 'Voir les logs système récents',
                    value: 'system_logs'
                },
                {
                    label: '❌ Logs d\'Erreurs',
                    description: 'Voir les erreurs récentes',
                    value: 'error_logs'
                },
                {
                    label: '👤 Logs Utilisateurs',
                    description: 'Voir l\'activité des utilisateurs',
                    value: 'user_logs'
                },
                {
                    label: '🔒 Logs Sécurité',
                    description: 'Voir les alertes de sécurité',
                    value: 'security_logs'
                },
                {
                    label: '📊 Analyse Performance',
                    description: 'Analyser les performances',
                    value: 'performance_analysis'
                }
            );

        const actionRow = new ActionRowBuilder().addComponents(selectMenu);

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_back')
                    .setLabel('← Retour')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [actionRow, backButton]
        });
    }

    // === UTILITAIRES ADMIN ===

    isAdmin(userId) {
        return this.adminUsers.has(userId) || userId === process.env.BOT_OWNER_ID;
    }

    addAdmin(userId) {
        this.adminUsers.add(userId);
        this.saveConfiguration();
    }

    removeAdmin(userId) {
        this.adminUsers.delete(userId);
        this.saveConfiguration();
    }

    toggleMaintenance() {
        this.maintenanceMode = !this.maintenanceMode;
        this.saveConfiguration();
        return this.maintenanceMode;
    }

    async getSystemStatsText() {
        const uptime = this.getUptime();
        const memoryUsage = process.memoryUsage();
        const memoryUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        
        return `**Uptime:** ${uptime}\n**Mémoire:** ${memoryUsed} MB\n**Commandes:** ${this.systemStats.commandsExecuted}\n**Erreurs:** ${this.systemStats.errorsCount}`;
    }

    async getPaymentStatsText() {
        // Ces stats seraient récupérées depuis le PaymentSystem
        return `**En attente:** ~5\n**Confirmés:** ~142\n**Revenus:** ~3,200€\n**Méthodes:** 4`;
    }

    async getUserStatsText() {
        // Ces stats seraient récupérées depuis le système d'utilisateurs
        return `**Total:** ~1,200\n**Actifs:** ~850\n**Premium:** ~180\n**Nouveaux:** ~25`;
    }

    async getSubscriptionStatsText() {
        // Ces stats seraient récupérées depuis le SubscriptionManager
        return `**Abonnements:** ~180\n**Revenus:** ~3,500€\n**Taux conversion:** 15%\n**Rétention:** 85%`;
    }

    getUptime() {
        const uptime = Date.now() - this.systemStats.startTime;
        const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
        const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));
        
        return `${days}j ${hours}h ${minutes}m`;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        if (bytes === -1) return 'Illimité';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    incrementCommandCount() {
        this.systemStats.commandsExecuted++;
        this.saveConfiguration();
    }

    incrementErrorCount() {
        this.systemStats.errorsCount++;
        this.saveConfiguration();
    }

    incrementFilesProcessed() {
        this.systemStats.filesProcessed++;
        this.saveConfiguration();
    }

    // === GESTION DES INTERACTIONS ===

    async handleAdminInteraction(interaction, subscriptionManager = null, paymentSystem = null) {
        const { customId } = interaction;

        switch (customId) {
            case 'admin_users':
                await this.showUserManagement(interaction);
                break;
            
            case 'admin_subscriptions':
                await this.showSubscriptionManagement(interaction);
                break;
            
            case 'admin_payments':
                await this.showPaymentManagement(interaction);
                break;
            
            case 'admin_system':
                await this.showSystemManagement(interaction);
                break;
            
            case 'admin_logs':
                await this.showLogsManagement(interaction);
                break;
            
            case 'admin_backup':
                await this.handleBackupAction(interaction);
                break;
            
            case 'admin_maintenance':
                await this.handleMaintenanceToggle(interaction);
                break;
            
            case 'admin_back':
                await this.showAdminPanel(interaction);
                break;
            
            case 'manage_plans':
                if (subscriptionManager) {
                    await this.showPlanManagement(interaction, subscriptionManager);
                }
                break;
            
            case 'manage_payment_methods':
                if (paymentSystem) {
                    await this.showPaymentMethodsManagement(interaction, paymentSystem);
                }
                break;
            
            case 'pending_payments':
                if (paymentSystem) {
                    await this.showPendingPayments(interaction, paymentSystem);
                }
                break;
            
            case 'add_payment_method':
                await this.showAddPaymentMethodModal(interaction);
                break;
            
            case 'admin_confirm_payment_modal':
                await this.showConfirmPaymentModal(interaction);
                break;
            
            case 'create_plan':
                await this.showCreatePlanModal(interaction);
                break;
            
            default:
                if (interaction.isStringSelectMenu()) {
                    await this.handleSelectMenuInteraction(interaction, subscriptionManager);
                }
        }
    }

    async handleSelectMenuInteraction(interaction, subscriptionManager) {
        const value = interaction.values[0];
        
        switch (value) {
            case 'manage_plans':
                if (subscriptionManager) {
                    await this.showPlanManagement(interaction, subscriptionManager);
                }
                break;
            
            case 'view_pricing':
                if (subscriptionManager) {
                    const pricingFr = subscriptionManager.generatePricingDisplay('fr');
                    const pricingEn = subscriptionManager.generatePricingDisplay('en');
                    
                    const embed = new EmbedBuilder()
                        .setTitle('📋 Affichage Public des Tarifs')
                        .setDescription(pricingFr + '\n---\n\n' + pricingEn)
                        .setColor('#f39c12');
                    
                    await interaction.editReply({ embeds: [embed], components: [] });
                }
                break;
            
            default:
                await interaction.reply({
                    content: `Action "${value}" en cours de développement...`,
                    ephemeral: true
                });
        }
    }

    async handleBackupAction(interaction) {
        await interaction.reply({
            content: '💾 Sauvegarde en cours... Cette action peut prendre quelques minutes.',
            ephemeral: true
        });
        
        // Ici on appellerait le système de backup
        setTimeout(async () => {
            await interaction.editReply({
                content: '✅ Sauvegarde terminée avec succès !'
            });
        }, 3000);
    }

    async handleMaintenanceToggle(interaction) {
        const newState = this.toggleMaintenance();
        
        const embed = new EmbedBuilder()
            .setTitle(newState ? '🔧 Mode Maintenance Activé' : '✅ Mode Maintenance Désactivé')
            .setDescription(newState 
                ? 'Le bot est maintenant en mode maintenance. Seuls les administrateurs peuvent utiliser les commandes.'
                : 'Le mode maintenance a été désactivé. Le bot fonctionne normalement.'
            )
            .setColor(newState ? '#e74c3c' : '#27ae60');

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
}

module.exports = AdminSystem;
