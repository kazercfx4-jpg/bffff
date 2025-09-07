const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class SubscriptionManager {
    constructor() {
        this.subscriptions = new Map();
        this.subscriptionPlans = new Map();
        this.userSubscriptions = new Map();
        this.subscriptionHistory = [];
        this.configPath = path.join(__dirname, '..', 'data', 'subscriptions.json');
        
        this.loadConfiguration();
        this.initializeDefaultPlans();
        this.startSubscriptionChecker();
    }

    loadConfiguration() {
        try {
            if (fs.existsSync(this.configPath)) {
                const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                this.subscriptions = new Map(config.subscriptions || []);
                this.subscriptionPlans = new Map(config.subscriptionPlans || []);
                this.userSubscriptions = new Map(config.userSubscriptions || []);
                this.subscriptionHistory = config.subscriptionHistory || [];
            }
        } catch (error) {
            console.error('Erreur chargement abonnements:', error);
        }
    }

    saveConfiguration() {
        try {
            const config = {
                subscriptions: Array.from(this.subscriptions.entries()),
                subscriptionPlans: Array.from(this.subscriptionPlans.entries()),
                userSubscriptions: Array.from(this.userSubscriptions.entries()),
                subscriptionHistory: this.subscriptionHistory.slice(-1000)
            };
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('Erreur sauvegarde abonnements:', error);
        }
    }

    initializeDefaultPlans() {
        // Plan Gratuit
        this.subscriptionPlans.set('free', {
            id: 'free',
            name: 'Gratuit',
            nameEn: 'Free',
            price: 0,
            currency: 'EUR',
            duration: 'lifetime',
            features: {
                filesPerMonth: 5,
                maxFileSize: 1048576, // 1MB
                obfuscationLevel: 2,
                supportPriority: 'low',
                apiAccess: false,
                webhookSupport: false,
                advancedFeatures: false
            },
            limits: {
                dailyFiles: 2,
                concurrentProcessing: 1,
                archiveSize: 5242880, // 5MB
                storageTime: 7 // jours
            },
            description: 'Plan de base pour découvrir nos services',
            descriptionEn: 'Basic plan to discover our services',
            color: '#95a5a6',
            icon: '🆓'
        });

        // Plan Starter (15€ - 50 fichiers/mois)
        this.subscriptionPlans.set('starter', {
            id: 'starter',
            name: 'Starter',
            nameEn: 'Starter',
            price: 15,
            currency: 'EUR',
            duration: 'monthly',
            features: {
                filesPerMonth: 50,
                maxFileSize: 10485760, // 10MB
                obfuscationLevel: 4,
                supportPriority: 'normal',
                apiAccess: true,
                webhookSupport: false,
                advancedFeatures: false
            },
            limits: {
                dailyFiles: 10,
                concurrentProcessing: 2,
                archiveSize: 52428800, // 50MB
                storageTime: 30 // jours
            },
            description: 'Idéal pour les petits projets et développeurs indépendants',
            descriptionEn: 'Perfect for small projects and independent developers',
            color: '#3498db',
            icon: '🚀'
        });

        // Plan Standard (25€ - 100 fichiers/mois)
        this.subscriptionPlans.set('standard', {
            id: 'standard',
            name: 'Standard',
            nameEn: 'Standard',
            price: 25,
            currency: 'EUR',
            duration: 'monthly',
            features: {
                filesPerMonth: 100,
                maxFileSize: 52428800, // 50MB
                obfuscationLevel: 5,
                supportPriority: 'high',
                apiAccess: true,
                webhookSupport: true,
                advancedFeatures: true
            },
            limits: {
                dailyFiles: 20,
                concurrentProcessing: 3,
                archiveSize: 104857600, // 100MB
                storageTime: 60 // jours
            },
            description: 'Parfait pour les équipes et projets moyens',
            descriptionEn: 'Perfect for teams and medium projects',
            color: '#e74c3c',
            icon: '⭐'
        });

        // Plan Pro (50€ - 1000 fichiers/mois) - Meilleure offre
        this.subscriptionPlans.set('pro', {
            id: 'pro',
            name: 'Pro',
            nameEn: 'Pro',
            price: 50,
            currency: 'EUR',
            duration: 'monthly',
            features: {
                filesPerMonth: 1000,
                maxFileSize: 104857600, // 100MB
                obfuscationLevel: 5,
                supportPriority: 'premium',
                apiAccess: true,
                webhookSupport: true,
                advancedFeatures: true
            },
            limits: {
                dailyFiles: 100,
                concurrentProcessing: 5,
                archiveSize: 524288000, // 500MB
                storageTime: 90 // jours
            },
            description: '🔥 MEILLEURE OFFRE - Pour les grandes entreprises',
            descriptionEn: '🔥 BEST DEAL - For large enterprises',
            color: '#f39c12',
            icon: '💎',
            bestDeal: true
        });

        // Plan Enterprise (sur devis)
        this.subscriptionPlans.set('enterprise', {
            id: 'enterprise',
            name: 'Enterprise',
            nameEn: 'Enterprise',
            price: 0, // Sur devis
            currency: 'EUR',
            duration: 'custom',
            features: {
                filesPerMonth: -1, // Illimité
                maxFileSize: -1, // Illimité
                obfuscationLevel: 5,
                supportPriority: 'vip',
                apiAccess: true,
                webhookSupport: true,
                advancedFeatures: true
            },
            limits: {
                dailyFiles: -1, // Illimité
                concurrentProcessing: 10,
                archiveSize: -1, // Illimité
                storageTime: 365 // 1 an
            },
            description: 'Solution sur mesure avec support dédié',
            descriptionEn: 'Custom solution with dedicated support',
            color: '#9b59b6',
            icon: '🏢',
            custom: true
        });
    }

    // === GESTION DES PLANS ===

    createSubscriptionPlan(planData) {
        const planId = planData.id || crypto.randomUUID();
        
        const plan = {
            id: planId,
            name: planData.name,
            nameEn: planData.nameEn || planData.name,
            price: planData.price || 0,
            currency: planData.currency || 'EUR',
            duration: planData.duration || 'monthly',
            features: {
                filesPerMonth: planData.features?.filesPerMonth || 10,
                maxFileSize: planData.features?.maxFileSize || 1048576,
                obfuscationLevel: planData.features?.obfuscationLevel || 3,
                supportPriority: planData.features?.supportPriority || 'normal',
                apiAccess: planData.features?.apiAccess || false,
                webhookSupport: planData.features?.webhookSupport || false,
                advancedFeatures: planData.features?.advancedFeatures || false
            },
            limits: {
                dailyFiles: planData.limits?.dailyFiles || 5,
                concurrentProcessing: planData.limits?.concurrentProcessing || 1,
                archiveSize: planData.limits?.archiveSize || 10485760,
                storageTime: planData.limits?.storageTime || 30
            },
            description: planData.description || '',
            descriptionEn: planData.descriptionEn || planData.description || '',
            color: planData.color || '#3498db',
            icon: planData.icon || '📦',
            active: planData.active !== false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.subscriptionPlans.set(planId, plan);
        this.saveConfiguration();
        
        return plan;
    }

    updateSubscriptionPlan(planId, updates) {
        const plan = this.subscriptionPlans.get(planId);
        if (!plan) return null;

        // Mise à jour des propriétés
        Object.assign(plan, updates, { updatedAt: new Date().toISOString() });
        
        // Mise à jour des features si fourni
        if (updates.features) {
            Object.assign(plan.features, updates.features);
        }
        
        // Mise à jour des limits si fourni
        if (updates.limits) {
            Object.assign(plan.limits, updates.limits);
        }

        this.subscriptionPlans.set(planId, plan);
        this.saveConfiguration();
        
        return plan;
    }

    deleteSubscriptionPlan(planId) {
        // Vérifier qu'aucun utilisateur n'a ce plan
        const usersWithPlan = Array.from(this.userSubscriptions.values())
            .filter(sub => sub.planId === planId && sub.status === 'active');
        
        if (usersWithPlan.length > 0) {
            throw new Error(`Impossible de supprimer le plan: ${usersWithPlan.length} utilisateurs actifs`);
        }

        const deleted = this.subscriptionPlans.delete(planId);
        if (deleted) {
            this.saveConfiguration();
        }
        
        return deleted;
    }

    getSubscriptionPlan(planId) {
        return this.subscriptionPlans.get(planId);
    }

    getAllSubscriptionPlans(activeOnly = false) {
        const plans = Array.from(this.subscriptionPlans.values());
        
        if (activeOnly) {
            return plans.filter(plan => plan.active !== false);
        }
        
        return plans.sort((a, b) => (a.price || 0) - (b.price || 0));
    }

    // === GESTION DES ABONNEMENTS UTILISATEURS ===

    subscribeUser(userId, planId, duration = null, paymentMethod = 'manual') {
        const plan = this.subscriptionPlans.get(planId);
        if (!plan) {
            throw new Error(`Plan d'abonnement ${planId} non trouvé`);
        }

        // Calculer les dates
        const startDate = new Date();
        let endDate = null;
        
        if (plan.duration !== 'lifetime') {
            endDate = new Date(startDate);
            
            switch (duration || plan.duration) {
                case 'weekly':
                    endDate.setDate(endDate.getDate() + 7);
                    break;
                case 'monthly':
                    endDate.setMonth(endDate.getMonth() + 1);
                    break;
                case 'quarterly':
                    endDate.setMonth(endDate.getMonth() + 3);
                    break;
                case 'yearly':
                    endDate.setFullYear(endDate.getFullYear() + 1);
                    break;
                case 'custom':
                    // Sera défini manuellement
                    break;
                default:
                    endDate.setMonth(endDate.getMonth() + 1); // Mensuel par défaut
            }
        }

        // Annuler l'ancien abonnement s'il existe
        const existingSubscription = this.userSubscriptions.get(userId);
        if (existingSubscription && existingSubscription.status === 'active') {
            existingSubscription.status = 'cancelled';
            existingSubscription.cancelledAt = new Date().toISOString();
        }

        // Créer le nouvel abonnement
        const subscriptionId = crypto.randomUUID();
        const subscription = {
            id: subscriptionId,
            userId,
            planId,
            status: 'active',
            startDate: startDate.toISOString(),
            endDate: endDate?.toISOString() || null,
            paymentMethod,
            filesUsed: 0,
            filesRemaining: plan.features.filesPerMonth,
            lastResetDate: startDate.toISOString(),
            autoRenew: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.userSubscriptions.set(userId, subscription);
        this.subscriptions.set(subscriptionId, subscription);

        // Ajouter à l'historique
        this.addToHistory({
            type: 'subscription_created',
            userId,
            planId,
            subscriptionId,
            timestamp: new Date().toISOString()
        });

        this.saveConfiguration();
        return subscription;
    }

    cancelUserSubscription(userId, reason = 'user_request') {
        const subscription = this.userSubscriptions.get(userId);
        if (!subscription) {
            throw new Error('Aucun abonnement trouvé pour cet utilisateur');
        }

        subscription.status = 'cancelled';
        subscription.cancelledAt = new Date().toISOString();
        subscription.cancellationReason = reason;
        subscription.updatedAt = new Date().toISOString();

        // Ajouter à l'historique
        this.addToHistory({
            type: 'subscription_cancelled',
            userId,
            planId: subscription.planId,
            subscriptionId: subscription.id,
            reason,
            timestamp: new Date().toISOString()
        });

        this.saveConfiguration();
        return subscription;
    }

    renewUserSubscription(userId, newEndDate = null) {
        const subscription = this.userSubscriptions.get(userId);
        if (!subscription) {
            throw new Error('Aucun abonnement trouvé pour cet utilisateur');
        }

        const plan = this.subscriptionPlans.get(subscription.planId);
        if (!plan) {
            throw new Error('Plan d\'abonnement non trouvé');
        }

        // Calculer la nouvelle date de fin
        if (!newEndDate) {
            const currentEnd = new Date(subscription.endDate || new Date());
            newEndDate = new Date(currentEnd);
            
            switch (plan.duration) {
                case 'weekly':
                    newEndDate.setDate(newEndDate.getDate() + 7);
                    break;
                case 'monthly':
                    newEndDate.setMonth(newEndDate.getMonth() + 1);
                    break;
                case 'quarterly':
                    newEndDate.setMonth(newEndDate.getMonth() + 3);
                    break;
                case 'yearly':
                    newEndDate.setFullYear(newEndDate.getFullYear() + 1);
                    break;
                default:
                    newEndDate.setMonth(newEndDate.getMonth() + 1);
            }
        }

        subscription.endDate = newEndDate.toISOString();
        subscription.status = 'active';
        subscription.updatedAt = new Date().toISOString();

        // Reset des fichiers si nouveau mois
        const now = new Date();
        const lastReset = new Date(subscription.lastResetDate);
        
        if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
            subscription.filesUsed = 0;
            subscription.filesRemaining = plan.features.filesPerMonth;
            subscription.lastResetDate = now.toISOString();
        }

        // Ajouter à l'historique
        this.addToHistory({
            type: 'subscription_renewed',
            userId,
            planId: subscription.planId,
            subscriptionId: subscription.id,
            newEndDate: newEndDate.toISOString(),
            timestamp: new Date().toISOString()
        });

        this.saveConfiguration();
        return subscription;
    }

    // === GESTION DES QUOTAS ===

    canProcessFile(userId, fileSize = 0) {
        const subscription = this.getUserSubscription(userId);
        if (!subscription) {
            return { allowed: false, reason: 'Aucun abonnement actif' };
        }

        const plan = this.subscriptionPlans.get(subscription.planId);
        if (!plan) {
            return { allowed: false, reason: 'Plan d\'abonnement invalide' };
        }

        // Vérifier l'expiration
        if (subscription.endDate && new Date() > new Date(subscription.endDate)) {
            return { allowed: false, reason: 'Abonnement expiré' };
        }

        // Vérifier le quota mensuel
        if (plan.features.filesPerMonth !== -1 && subscription.filesRemaining <= 0) {
            return { 
                allowed: false, 
                reason: `Quota mensuel atteint (${plan.features.filesPerMonth} fichiers)`,
                resetDate: this.getNextResetDate(subscription)
            };
        }

        // Vérifier la taille du fichier
        if (plan.features.maxFileSize !== -1 && fileSize > plan.features.maxFileSize) {
            return { 
                allowed: false, 
                reason: `Fichier trop volumineux (max: ${this.formatBytes(plan.features.maxFileSize)})` 
            };
        }

        return { 
            allowed: true, 
            remaining: subscription.filesRemaining,
            plan: plan.name
        };
    }

    consumeFileQuota(userId, count = 1) {
        const subscription = this.userSubscriptions.get(userId);
        if (!subscription) return false;

        subscription.filesUsed += count;
        subscription.filesRemaining = Math.max(0, subscription.filesRemaining - count);
        subscription.updatedAt = new Date().toISOString();

        this.saveConfiguration();
        return true;
    }

    resetMonthlyQuotas() {
        const now = new Date();
        let resetCount = 0;

        for (const subscription of this.userSubscriptions.values()) {
            if (subscription.status !== 'active') continue;

            const lastReset = new Date(subscription.lastResetDate);
            const plan = this.subscriptionPlans.get(subscription.planId);
            
            if (!plan) continue;

            // Reset si nouveau mois
            if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
                subscription.filesUsed = 0;
                subscription.filesRemaining = plan.features.filesPerMonth;
                subscription.lastResetDate = now.toISOString();
                subscription.updatedAt = now.toISOString();
                resetCount++;
            }
        }

        if (resetCount > 0) {
            this.saveConfiguration();
        }

        return resetCount;
    }

    // === GETTERS ===

    getUserSubscription(userId) {
        const subscription = this.userSubscriptions.get(userId);
        
        if (!subscription) {
            // Retourner l'abonnement gratuit par défaut
            return {
                id: 'free_' + userId,
                userId,
                planId: 'free',
                status: 'active',
                startDate: new Date().toISOString(),
                endDate: null,
                filesUsed: 0,
                filesRemaining: 5,
                lastResetDate: new Date().toISOString()
            };
        }

        return subscription;
    }

    getUserPlan(userId) {
        const subscription = this.getUserSubscription(userId);
        return this.subscriptionPlans.get(subscription.planId);
    }

    getSubscriptionStats() {
        const stats = {
            totalSubscriptions: this.userSubscriptions.size,
            activeSubscriptions: 0,
            expiredSubscriptions: 0,
            cancelledSubscriptions: 0,
            revenueByPlan: {},
            usersByPlan: {}
        };

        for (const subscription of this.userSubscriptions.values()) {
            const plan = this.subscriptionPlans.get(subscription.planId);
            
            if (!plan) continue;

            // Compter par statut
            if (subscription.status === 'active') {
                stats.activeSubscriptions++;
            } else if (subscription.status === 'expired') {
                stats.expiredSubscriptions++;
            } else if (subscription.status === 'cancelled') {
                stats.cancelledSubscriptions++;
            }

            // Compter par plan
            stats.usersByPlan[plan.name] = (stats.usersByPlan[plan.name] || 0) + 1;
            
            // Calculer revenus (estimation)
            if (subscription.status === 'active') {
                stats.revenueByPlan[plan.name] = (stats.revenueByPlan[plan.name] || 0) + plan.price;
            }
        }

        return stats;
    }

    // === VÉRIFICATEUR D'ABONNEMENTS ===

    startSubscriptionChecker() {
        // Vérifier les abonnements expirés toutes les heures
        setInterval(() => {
            this.checkExpiredSubscriptions();
        }, 60 * 60 * 1000);

        // Reset quotas quotidien à minuit
        setInterval(() => {
            const now = new Date();
            if (now.getHours() === 0 && now.getMinutes() === 0) {
                this.resetMonthlyQuotas();
            }
        }, 60 * 1000);
    }

    checkExpiredSubscriptions() {
        const now = new Date();
        let expiredCount = 0;

        for (const subscription of this.userSubscriptions.values()) {
            if (subscription.status === 'active' && subscription.endDate) {
                const endDate = new Date(subscription.endDate);
                
                if (now > endDate) {
                    subscription.status = 'expired';
                    subscription.updatedAt = now.toISOString();
                    
                    this.addToHistory({
                        type: 'subscription_expired',
                        userId: subscription.userId,
                        planId: subscription.planId,
                        subscriptionId: subscription.id,
                        timestamp: now.toISOString()
                    });
                    
                    expiredCount++;
                }
            }
        }

        if (expiredCount > 0) {
            this.saveConfiguration();
            console.log(`🔄 ${expiredCount} abonnements expirés marqués`);
        }

        return expiredCount;
    }

    // === UTILITAIRES ===

    addToHistory(entry) {
        this.subscriptionHistory.push(entry);
        
        // Garder seulement les 1000 dernières entrées
        if (this.subscriptionHistory.length > 1000) {
            this.subscriptionHistory = this.subscriptionHistory.slice(-1000);
        }
    }

    getNextResetDate(subscription) {
        const resetDate = new Date(subscription.lastResetDate);
        resetDate.setMonth(resetDate.getMonth() + 1);
        resetDate.setDate(1);
        resetDate.setHours(0, 0, 0, 0);
        return resetDate;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        if (bytes === -1) return 'Illimité';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    generatePricingDisplay(language = 'fr') {
        const plans = this.getAllSubscriptionPlans(true)
            .filter(plan => plan.id !== 'free' && plan.id !== 'enterprise');

        const flag = language === 'fr' ? '🇫🇷' : '🇬🇧';
        const title = language === 'fr' 
            ? 'Service de Traitement de Fichiers – Offres Mensuelles'
            : 'File Processing Service – Monthly Offers';

        let display = `## ${flag} **${title}** 📂🔥\n\n`;
        display += `**💰 ${language === 'fr' ? 'Tarifs' : 'Prices'}:**\n`;

        for (const plan of plans) {
            const name = language === 'fr' ? plan.name : plan.nameEn;
            const filesText = language === 'fr' ? 'fichiers / mois' : 'files / month';
            const bestDealText = language === 'fr' ? '*(Meilleure offre)*' : '*(Best Deal)*';
            
            display += `🔹 **${plan.price}€ – ${plan.features.filesPerMonth} ${filesText}**`;
            
            if (plan.bestDeal) {
                display += ` 💸 ${bestDealText}`;
            }
            
            display += '\n';
        }

        const features = language === 'fr' 
            ? ['✅ Traitement rapide et efficace', '✅ Aucun délai si le quota est respecté', '✅ Support 24/7 via tickets']
            : ['✅ Fast and efficient processing', '✅ No delays if within your quota', '✅ 24/7 ticket support'];

        display += '\n' + features.join('\n') + '\n\n';

        const disclaimer = language === 'fr'
            ? '🔐 **Service privé – Aucun remboursement une fois le traitement lancé.**'
            : '🔐 **Private service – No refunds once processing has started.**';

        display += disclaimer + '\n';

        return display;
    }

    // === INTERFACE DE SOUSCRIPTION AVEC PAIEMENTS ===

    async showSubscriptionInterface(interaction, paymentSystem, ticketSystem, lang = 'fr') {
        // Afficher les plans disponibles
        const pricing = this.generatePricingDisplay(lang);
        
        const embed = new EmbedBuilder()
            .setTitle(lang === 'en' ? '💎 Choose Your Plan' : '💎 Choisissez Votre Plan')
            .setDescription(pricing)
            .setColor('#f39c12')
            .setFooter({
                text: lang === 'en' 
                    ? 'Select a plan to see payment options'
                    : 'Sélectionnez un plan pour voir les options de paiement'
            });

        // Boutons pour chaque plan
        const planButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('subscribe_starter')
                    .setLabel('🚀 Starter - 15€')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('subscribe_standard')
                    .setLabel('⭐ Standard - 25€')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('subscribe_pro')
                    .setLabel('💎 Pro - 50€')
                    .setStyle(ButtonStyle.Success)
            );

        const enterpriseButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('subscribe_enterprise')
                    .setLabel('🏢 Enterprise - Sur mesure')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.reply({
            embeds: [embed],
            components: [planButtons, enterpriseButton],
            ephemeral: true
        });
    }

    async showPaymentOptions(interaction, planId, paymentSystem, ticketSystem, lang = 'fr') {
        const plan = this.getSubscriptionPlan(planId);
        
        if (!plan) {
            return await interaction.reply({
                content: lang === 'en' ? 'Plan not found.' : 'Plan non trouvé.',
                ephemeral: true
            });
        }

        // Vérifier si l'utilisateur a déjà un abonnement actif
        const existingSubscription = this.getUserSubscription(interaction.user.id);
        if (existingSubscription && existingSubscription.status === 'active') {
            return await interaction.reply({
                content: lang === 'en' 
                    ? 'You already have an active subscription. Use `/profile` to view details.'
                    : 'Vous avez déjà un abonnement actif. Utilisez `/profile` pour voir les détails.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(lang === 'en' ? `💳 Payment for ${plan.nameEn}` : `💳 Paiement pour ${plan.name}`)
            .setDescription(lang === 'en' 
                ? `You selected the **${plan.nameEn}** plan.\nChoose your preferred payment method:`
                : `Vous avez sélectionné le plan **${plan.name}**.\nChoisissez votre moyen de paiement préféré :`
            )
            .setColor('#27ae60')
            .addFields(
                {
                    name: lang === 'en' ? '📦 Plan Details' : '📦 Détails du Plan',
                    value: lang === 'en' 
                        ? `• **Price:** ${plan.price}€/month\n• **Files:** ${plan.features.filesPerMonth === -1 ? 'Unlimited' : plan.features.filesPerMonth}/month\n• **Max size:** ${this.formatBytes(plan.features.maxFileSize)}`
                        : `• **Prix:** ${plan.price}€/mois\n• **Fichiers:** ${plan.features.filesPerMonth === -1 ? 'Illimité' : plan.features.filesPerMonth}/mois\n• **Taille max:** ${this.formatBytes(plan.features.maxFileSize)}`,
                    inline: false
                }
            );

        // Génerer les boutons de moyens de paiement
        const paymentButtons = paymentSystem.generatePaymentMethodButtons();
        
        // Ajouter un bouton d'annulation
        const cancelButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('payment_cancel')
                    .setLabel(lang === 'en' ? '❌ Cancel' : '❌ Annuler')
                    .setStyle(ButtonStyle.Danger)
            );

        const components = [...paymentButtons, cancelButton];

        await interaction.reply({
            embeds: [embed],
            components: components,
            ephemeral: true
        });

        // Stocker le planId pour la prochaine interaction
        interaction.planId = planId;
    }

    async processPaymentSelection(interaction, planId, methodId, paymentSystem, ticketSystem) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const result = await paymentSystem.initiatePayment(
                interaction.user.id, 
                planId, 
                methodId, 
                this, 
                ticketSystem
            );

            const embed = new EmbedBuilder()
                .setTitle('🎫 Ticket de Paiement Créé')
                .setDescription(`Un ticket privé a été créé pour votre paiement.\nVeuillez suivre les instructions dans ${result.ticketChannel}.`)
                .setColor('#27ae60')
                .addFields(
                    {
                        name: '🆔 ID de Paiement',
                        value: `\`${result.paymentId}\``,
                        inline: true
                    },
                    {
                        name: '💳 Moyen de Paiement',
                        value: `${result.method.icon} ${result.method.name}`,
                        inline: true
                    },
                    {
                        name: '📦 Plan',
                        value: `${result.plan.icon} ${result.plan.name} (${result.plan.price}€)`,
                        inline: true
                    }
                )
                .setFooter({
                    text: 'Le ticket sera automatiquement fermé après 24h sans paiement'
                });

            await interaction.editReply({
                embeds: [embed]
            });

        } catch (error) {
            console.error('Erreur processus paiement:', error);
            
            await interaction.editReply({
                content: `❌ Erreur lors de la création du ticket de paiement: ${error.message}`
            });
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        if (bytes === -1) return 'Illimité';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = SubscriptionManager;
