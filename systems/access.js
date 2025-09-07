const { EmbedBuilder } = require('discord.js');

class AccessManager {
    constructor() {
        this.subscriptions = new Map();
        this.usageStats = new Map();
        this.plans = {
            'daily': {
                name: '🌟 Journalier',
                duration: 24 * 60 * 60 * 1000, // 24 heures
                limit: 10
            },
            'monthly': {
                name: '🌙 Mensuel',
                duration: 30 * 24 * 60 * 60 * 1000, // 30 jours
                limit: 100
            },
            'yearly': {
                name: '☀️ Annuel',
                duration: 365 * 24 * 60 * 60 * 1000, // 365 jours
                limit: 1000
            }
        };
    }

    async getUserSubscription(userId) {
        const sub = this.subscriptions.get(userId);
        if (!sub) return null;

        // Vérifier si l'abonnement est expiré
        if (Date.now() > sub.expiresAt) {
            this.subscriptions.delete(userId);
            return null;
        }

        return sub;
    }

    async getUserDailyUsage(userId) {
        const stats = this.usageStats.get(userId);
        if (!stats) return 0;

        // Réinitialiser le compteur si c'est un nouveau jour
        const today = new Date().toDateString();
        if (stats.date !== today) {
            stats.count = 0;
            stats.date = today;
            this.usageStats.set(userId, stats);
        }

        return stats.count;
    }

    async incrementUserUsage(userId) {
        const today = new Date().toDateString();
        const stats = this.usageStats.get(userId) || { date: today, count: 0 };

        if (stats.date !== today) {
            stats.count = 0;
            stats.date = today;
        }

        stats.count++;
        this.usageStats.set(userId, stats);
    }

    async handleCommand(interaction, subcommand, lang) {
        switch (subcommand) {
            case 'add':
                const user = interaction.options.getUser('user');
                const plan = interaction.options.getString('plan');
                await this.addSubscription(interaction, user, plan, lang);
                break;

            case 'remove':
                const removeUser = interaction.options.getUser('user');
                await this.removeSubscription(interaction, removeUser, lang);
                break;

            case 'info':
                const checkUser = interaction.options.getUser('user');
                await this.showSubscriptionInfo(interaction, checkUser, lang);
                break;

            case 'list':
                await this.listSubscriptions(interaction, lang);
                break;
        }
    }

    async addSubscription(interaction, user, plan, lang) {
        if (!this.plans[plan]) {
            return await interaction.reply({
                content: lang === 'fr'
                    ? '❌ Plan d\'abonnement invalide'
                    : '❌ Invalid subscription plan',
                ephemeral: true
            });
        }

        const subscription = {
            plan,
            startedAt: Date.now(),
            expiresAt: Date.now() + this.plans[plan].duration,
            limit: this.plans[plan].limit
        };

        this.subscriptions.set(user.id, subscription);

        const embed = new EmbedBuilder()
            .setTitle(lang === 'fr' ? '✅ Abonnement Ajouté' : '✅ Subscription Added')
            .setColor('#00ff00')
            .addFields(
                {
                    name: lang === 'fr' ? 'Utilisateur' : 'User',
                    value: user.tag,
                    inline: true
                },
                {
                    name: lang === 'fr' ? 'Plan' : 'Plan',
                    value: this.plans[plan].name,
                    inline: true
                },
                {
                    name: lang === 'fr' ? 'Limite quotidienne' : 'Daily Limit',
                    value: subscription.limit.toString(),
                    inline: true
                },
                {
                    name: lang === 'fr' ? 'Expire le' : 'Expires on',
                    value: `<t:${Math.floor(subscription.expiresAt / 1000)}:F>`
                }
            );

        await interaction.reply({ embeds: [embed] });
    }

    async removeSubscription(interaction, user, lang) {
        if (!this.subscriptions.has(user.id)) {
            return await interaction.reply({
                content: lang === 'fr'
                    ? '❌ Cet utilisateur n\'a pas d\'abonnement'
                    : '❌ This user does not have a subscription',
                ephemeral: true
            });
        }

        this.subscriptions.delete(user.id);

        await interaction.reply({
            content: lang === 'fr'
                ? `✅ Abonnement de ${user.tag} supprimé`
                : `✅ ${user.tag}'s subscription removed`,
            ephemeral: true
        });
    }

    async showSubscriptionInfo(interaction, user, lang) {
        const subscription = await this.getUserSubscription(user.id);
        if (!subscription) {
            return await interaction.reply({
                content: lang === 'fr'
                    ? '❌ Cet utilisateur n\'a pas d\'abonnement'
                    : '❌ This user does not have a subscription',
                ephemeral: true
            });
        }

        const usage = await this.getUserDailyUsage(user.id);
        const embed = new EmbedBuilder()
            .setTitle(lang === 'fr' ? '📊 Informations Abonnement' : '📊 Subscription Information')
            .setColor('#0099ff')
            .addFields(
                {
                    name: lang === 'fr' ? 'Utilisateur' : 'User',
                    value: user.tag,
                    inline: true
                },
                {
                    name: lang === 'fr' ? 'Plan' : 'Plan',
                    value: this.plans[subscription.plan].name,
                    inline: true
                },
                {
                    name: lang === 'fr' ? 'Limite quotidienne' : 'Daily Limit',
                    value: `${usage}/${subscription.limit}`,
                    inline: true
                },
                {
                    name: lang === 'fr' ? 'Expire le' : 'Expires on',
                    value: `<t:${Math.floor(subscription.expiresAt / 1000)}:F>`
                }
            );

        await interaction.reply({ embeds: [embed] });
    }

    async listSubscriptions(interaction, lang) {
        const activeSubscriptions = Array.from(this.subscriptions.entries())
            .filter(([_, sub]) => Date.now() <= sub.expiresAt);

        if (activeSubscriptions.length === 0) {
            return await interaction.reply({
                content: lang === 'fr'
                    ? '📝 Aucun abonnement actif'
                    : '📝 No active subscriptions',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(lang === 'fr' ? '📋 Liste des Abonnements' : '📋 Subscription List')
            .setColor('#0099ff')
            .setDescription(
                activeSubscriptions.map(([userId, sub]) => {
                    const user = interaction.client.users.cache.get(userId);
                    return lang === 'fr'
                        ? `${user?.tag || userId} - ${this.plans[sub.plan].name} (Expire <t:${Math.floor(sub.expiresAt / 1000)}:R>)`
                        : `${user?.tag || userId} - ${this.plans[sub.plan].name} (Expires <t:${Math.floor(sub.expiresAt / 1000)}:R>)`;
                }).join('\n')
            );

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = AccessManager;
