const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

class PaymentSystem {
    constructor() {
        this.paymentMethods = new Map();
        this.pendingPayments = new Map();
        this.paymentHistory = [];
        this.configPath = path.join(__dirname, '..', 'data', 'payments.json');
        
        this.loadConfiguration();
        this.initializeDefaultPaymentMethods();
    }

    loadConfiguration() {
        try {
            if (fs.existsSync(this.configPath)) {
                const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                this.paymentMethods = new Map(config.paymentMethods || []);
                this.pendingPayments = new Map(config.pendingPayments || []);
                this.paymentHistory = config.paymentHistory || [];
            }
        } catch (error) {
            console.error('Erreur chargement paiements:', error);
        }
    }

    saveConfiguration() {
        try {
            const config = {
                paymentMethods: Array.from(this.paymentMethods.entries()),
                pendingPayments: Array.from(this.pendingPayments.entries()),
                paymentHistory: this.paymentHistory.slice(-1000)
            };
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('Erreur sauvegarde paiements:', error);
        }
    }

    initializeDefaultPaymentMethods() {
        // Moyens de paiement par défaut
        this.paymentMethods.set('paypal', {
            id: 'paypal',
            name: 'PayPal',
            nameEn: 'PayPal',
            icon: '💳',
            active: true,
            details: {
                email: 'payments@fsprotect.com',
                instructions: 'Envoyez le paiement à payments@fsprotect.com avec votre ID Discord en référence',
                instructionsEn: 'Send payment to payments@fsprotect.com with your Discord ID as reference'
            }
        });

        this.paymentMethods.set('crypto', {
            id: 'crypto',
            name: 'Cryptomonnaie',
            nameEn: 'Cryptocurrency',
            icon: '₿',
            active: true,
            details: {
                address: 'bc1qexampleaddress123456789',
                instructions: 'Envoyez le montant en Bitcoin à l\'adresse ci-dessus',
                instructionsEn: 'Send the amount in Bitcoin to the address above'
            }
        });

        this.paymentMethods.set('bank', {
            id: 'bank',
            name: 'Virement Bancaire',
            nameEn: 'Bank Transfer',
            icon: '🏦',
            active: true,
            details: {
                iban: 'FR76 1234 5678 9012 3456 789',
                bic: 'EXAMPLE123',
                instructions: 'Effectuez un virement avec votre ID Discord en référence',
                instructionsEn: 'Make a transfer with your Discord ID as reference'
            }
        });

        this.paymentMethods.set('pcs', {
            id: 'pcs',
            name: 'Carte PCS',
            nameEn: 'PCS Card',
            icon: '💳',
            active: true,
            details: {
                instructions: 'Contactez un administrateur pour les détails PCS',
                instructionsEn: 'Contact an administrator for PCS details'
            }
        });

        this.saveConfiguration();
    }

    // === GESTION DES MOYENS DE PAIEMENT (ADMIN) ===

    addPaymentMethod(methodData) {
        const id = methodData.id || this.generateId();
        this.paymentMethods.set(id, {
            id,
            name: methodData.name,
            nameEn: methodData.nameEn || methodData.name,
            icon: methodData.icon || '💳',
            active: methodData.active !== false,
            details: methodData.details || {}
        });
        this.saveConfiguration();
        return id;
    }

    updatePaymentMethod(id, updates) {
        if (this.paymentMethods.has(id)) {
            const method = this.paymentMethods.get(id);
            this.paymentMethods.set(id, { ...method, ...updates });
            this.saveConfiguration();
            return true;
        }
        return false;
    }

    removePaymentMethod(id) {
        const deleted = this.paymentMethods.delete(id);
        if (deleted) this.saveConfiguration();
        return deleted;
    }

    togglePaymentMethod(id) {
        if (this.paymentMethods.has(id)) {
            const method = this.paymentMethods.get(id);
            method.active = !method.active;
            this.saveConfiguration();
            return method.active;
        }
        return false;
    }

    getActivePaymentMethods() {
        return Array.from(this.paymentMethods.values()).filter(method => method.active);
    }

    // === AFFICHAGE DES MOYENS DE PAIEMENT ===

    generatePaymentMethodsEmbed(lang = 'fr') {
        const activeMethods = this.getActivePaymentMethods();
        
        const embed = new EmbedBuilder()
            .setTitle(lang === 'en' ? '💳 Available Payment Methods' : '💳 Moyens de Paiement Disponibles')
            .setDescription(lang === 'en' 
                ? 'Choose your preferred payment method:'
                : 'Choisissez votre moyen de paiement préféré :'
            )
            .setColor('#27ae60');

        activeMethods.forEach(method => {
            embed.addFields({
                name: `${method.icon} ${lang === 'en' ? method.nameEn : method.name}`,
                value: lang === 'en' ? method.details.instructionsEn || method.details.instructions : method.details.instructions,
                inline: false
            });
        });

        return embed;
    }

    generatePaymentMethodButtons() {
        const activeMethods = this.getActivePaymentMethods();
        const rows = [];
        
        // Diviser en rangées de 5 boutons maximum
        for (let i = 0; i < activeMethods.length; i += 5) {
            const row = new ActionRowBuilder();
            const methodsSlice = activeMethods.slice(i, i + 5);
            
            methodsSlice.forEach(method => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`payment_select_${method.id}`)
                        .setLabel(method.name)
                        .setEmoji(method.icon)
                        .setStyle(ButtonStyle.Primary)
                );
            });
            
            rows.push(row);
        }

        return rows;
    }

    // === PROCESSUS DE PAIEMENT ===

    async initiatePayment(userId, planId, methodId, subscriptionManager, ticketSystem) {
        const method = this.paymentMethods.get(methodId);
        const plan = subscriptionManager.getSubscriptionPlan(planId);
        
        if (!method || !method.active) {
            throw new Error('Moyen de paiement non disponible');
        }

        if (!plan) {
            throw new Error('Plan d\'abonnement non trouvé');
        }

        // Générer un ID de paiement unique
        const paymentId = this.generatePaymentId();
        
        // Créer l'entrée de paiement en attente
        const paymentData = {
            id: paymentId,
            userId,
            planId,
            methodId,
            amount: plan.price,
            currency: 'EUR',
            status: 'pending',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Expire dans 24h
        };

        this.pendingPayments.set(paymentId, paymentData);
        this.saveConfiguration();

        // Créer le ticket de paiement
        const ticketData = await this.createPaymentTicket(paymentData, method, plan, ticketSystem);
        
        return {
            paymentId,
            ticketChannel: ticketData.channel,
            method,
            plan
        };
    }

    async createPaymentTicket(paymentData, method, plan, ticketSystem) {
        const ticketData = {
            userId: paymentData.userId,
            type: 'payment',
            subject: `Paiement ${plan.name} - ${paymentData.id}`,
            priority: 'normal',
            category: 'billing',
            metadata: {
                paymentId: paymentData.id,
                planId: paymentData.planId,
                methodId: paymentData.methodId,
                amount: paymentData.amount
            }
        };

        const ticket = await ticketSystem.createTicket(ticketData);
        
        // Envoyer les informations de paiement dans le ticket
        const paymentEmbed = this.generatePaymentInstructionsEmbed(paymentData, method, plan);
        
        await ticket.channel.send({
            embeds: [paymentEmbed],
            components: [this.generatePaymentTicketButtons(paymentData.id)]
        });

        return ticket;
    }

    generatePaymentInstructionsEmbed(paymentData, method, plan) {
        const embed = new EmbedBuilder()
            .setTitle(`💳 Instructions de Paiement - ${plan.name}`)
            .setDescription(`Voici les détails pour votre paiement via **${method.name}**`)
            .setColor('#f39c12')
            .addFields(
                {
                    name: '📦 Plan Sélectionné',
                    value: `${plan.icon} **${plan.name}**\n${plan.description}`,
                    inline: true
                },
                {
                    name: '💰 Montant',
                    value: `**${paymentData.amount}€**`,
                    inline: true
                },
                {
                    name: '💳 Moyen de Paiement',
                    value: `${method.icon} **${method.name}**`,
                    inline: true
                },
                {
                    name: '🔑 ID de Paiement',
                    value: `\`${paymentData.id}\``,
                    inline: false
                },
                {
                    name: '📋 Instructions',
                    value: method.details.instructions,
                    inline: false
                }
            )
            .setFooter({
                text: 'Ce ticket expire dans 24h si le paiement n\'est pas confirmé'
            })
            .setTimestamp();

        // Ajouter les détails spécifiques du moyen de paiement
        if (method.details.email) {
            embed.addFields({
                name: '📧 Email PayPal',
                value: `\`${method.details.email}\``,
                inline: true
            });
        }

        if (method.details.address) {
            embed.addFields({
                name: '₿ Adresse Crypto',
                value: `\`${method.details.address}\``,
                inline: false
            });
        }

        if (method.details.iban) {
            embed.addFields(
                {
                    name: '🏦 IBAN',
                    value: `\`${method.details.iban}\``,
                    inline: true
                },
                {
                    name: '🏦 BIC',
                    value: `\`${method.details.bic}\``,
                    inline: true
                }
            );
        }

        return embed;
    }

    generatePaymentTicketButtons(paymentId) {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`payment_confirm_${paymentId}`)
                    .setLabel('✅ Paiement Effectué')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`payment_cancel_${paymentId}`)
                    .setLabel('❌ Annuler')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`payment_help_${paymentId}`)
                    .setLabel('❓ Aide')
                    .setStyle(ButtonStyle.Secondary)
            );
    }

    // === CONFIRMATION DE PAIEMENT ===

    async confirmPayment(paymentId, adminId, subscriptionManager) {
        const payment = this.pendingPayments.get(paymentId);
        
        if (!payment) {
            throw new Error('Paiement non trouvé');
        }

        if (payment.status !== 'pending') {
            throw new Error('Ce paiement a déjà été traité');
        }

        // Marquer le paiement comme confirmé
        payment.status = 'confirmed';
        payment.confirmedAt = new Date().toISOString();
        payment.confirmedBy = adminId;

        // Activer l'abonnement
        const subscription = await subscriptionManager.subscribeUser(payment.userId, payment.planId);
        
        if (subscription.success) {
            payment.subscriptionId = subscription.subscriptionId;
            
            // Déplacer vers l'historique
            this.paymentHistory.push(payment);
            this.pendingPayments.delete(paymentId);
            
            this.saveConfiguration();
            
            return {
                success: true,
                payment,
                subscription: subscription.subscription
            };
        } else {
            throw new Error('Erreur lors de l\'activation de l\'abonnement');
        }
    }

    async cancelPayment(paymentId, reason = '') {
        const payment = this.pendingPayments.get(paymentId);
        
        if (!payment) {
            throw new Error('Paiement non trouvé');
        }

        payment.status = 'cancelled';
        payment.cancelledAt = new Date().toISOString();
        payment.cancelReason = reason;

        // Déplacer vers l'historique
        this.paymentHistory.push(payment);
        this.pendingPayments.delete(paymentId);
        
        this.saveConfiguration();
        
        return payment;
    }

    // === GESTION ADMIN DES PAIEMENTS ===

    getPendingPayments() {
        return Array.from(this.pendingPayments.values())
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    getPaymentHistory(limit = 50) {
        return this.paymentHistory
            .slice(-limit)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    getPaymentStats() {
        const pending = this.getPendingPayments();
        const confirmed = this.paymentHistory.filter(p => p.status === 'confirmed');
        const cancelled = this.paymentHistory.filter(p => p.status === 'cancelled');
        
        const totalRevenue = confirmed.reduce((sum, p) => sum + p.amount, 0);
        
        return {
            pending: pending.length,
            confirmed: confirmed.length,
            cancelled: cancelled.length,
            totalRevenue,
            averageAmount: confirmed.length > 0 ? totalRevenue / confirmed.length : 0
        };
    }

    // === UTILITAIRES ===

    generateId() {
        return crypto.randomBytes(8).toString('hex');
    }

    generatePaymentId() {
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(4).toString('hex');
        return `PAY_${timestamp}_${random}`.toUpperCase();
    }

    // === NETTOYAGE AUTOMATIQUE ===

    cleanExpiredPayments() {
        const now = new Date();
        let cleaned = 0;

        for (const [id, payment] of this.pendingPayments) {
            if (new Date(payment.expiresAt) < now && payment.status === 'pending') {
                payment.status = 'expired';
                payment.expiredAt = now.toISOString();
                
                this.paymentHistory.push(payment);
                this.pendingPayments.delete(id);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.saveConfiguration();
            console.log(`🧹 ${cleaned} paiements expirés nettoyés`);
        }

        return cleaned;
    }

    startPaymentCleaner() {
        // Nettoyer les paiements expirés toutes les heures
        setInterval(() => {
            this.cleanExpiredPayments();
        }, 60 * 60 * 1000);
        
        console.log('🧹 Nettoyeur de paiements démarré');
    }
}

module.exports = PaymentSystem;
