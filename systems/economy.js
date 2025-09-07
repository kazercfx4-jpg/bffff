const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

class EconomySystem {
    constructor(languageManager) {
        this.lang = languageManager;
        this.userBalances = new Map();
        this.dailyClaims = new Map();
        this.shopItems = new Map();
        this.transactions = new Map();
        this.loadData();
        this.initializeShop();
        
        // Auto-save toutes les 10 minutes
        setInterval(() => this.saveData(), 10 * 60 * 1000);
    }

    loadData() {
        try {
            const dataPath = path.join(__dirname, '..', 'data', 'economy.json');
            if (fs.existsSync(dataPath)) {
                const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                this.userBalances = new Map(data.balances || []);
                this.dailyClaims = new Map(data.dailyClaims || []);
                this.transactions = new Map(data.transactions || []);
            }
        } catch (error) {
            console.error('Erreur chargement données économie:', error);
        }
    }

    saveData() {
        try {
            const dataPath = path.join(__dirname, '..', 'data', 'economy.json');
            const data = {
                balances: Array.from(this.userBalances.entries()),
                dailyClaims: Array.from(this.dailyClaims.entries()),
                transactions: Array.from(this.transactions.entries())
            };
            fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Erreur sauvegarde données économie:', error);
        }
    }

    initializeShop() {
        this.shopItems.set('obfuscation_basic', {
            id: 'obfuscation_basic',
            name: 'Obfuscation Basic',
            description: '10 obfuscations avec protection standard',
            price: 100,
            category: 'obfuscation',
            emoji: '🔒',
            available: true
        });

        this.shopItems.set('obfuscation_premium', {
            id: 'obfuscation_premium',
            name: 'Obfuscation Premium',
            description: '50 obfuscations avec protection avancée',
            price: 400,
            category: 'obfuscation',
            emoji: '🛡️',
            available: true
        });

        this.shopItems.set('custom_preset', {
            id: 'custom_preset',
            name: 'Preset Personnalisé',
            description: 'Créez votre propre preset d\'obfuscation',
            price: 750,
            category: 'tools',
            emoji: '⚙️',
            available: true
        });

        this.shopItems.set('priority_support', {
            id: 'priority_support',
            name: 'Support Prioritaire',
            description: 'Support premium pendant 30 jours',
            price: 200,
            category: 'support',
            emoji: '🎫',
            available: true
        });

        this.shopItems.set('server_boost', {
            id: 'server_boost',
            name: 'Boost Serveur',
            description: 'Boostez votre serveur Discord pendant 7 jours',
            price: 150,
            category: 'boost',
            emoji: '🚀',
            available: true
        });

        this.shopItems.set('exclusive_role', {
            id: 'exclusive_role',
            name: 'Rôle Exclusif',
            description: 'Obtenez un rôle exclusif avec des avantages',
            price: 500,
            category: 'cosmetic',
            emoji: '👑',
            available: true
        });
    }

    // === GESTION DES CRÉDITS ===

    getBalance(userId) {
        return this.userBalances.get(userId) || 0;
    }

    addCredits(userId, amount, reason = 'Transaction') {
        const currentBalance = this.getBalance(userId);
        const newBalance = currentBalance + amount;
        this.userBalances.set(userId, newBalance);
        
        this.logTransaction(userId, amount, reason, 'credit');
        return newBalance;
    }

    removeCredits(userId, amount, reason = 'Achat') {
        const currentBalance = this.getBalance(userId);
        if (currentBalance < amount) {
            return false; // Fonds insuffisants
        }
        
        const newBalance = currentBalance - amount;
        this.userBalances.set(userId, newBalance);
        
        this.logTransaction(userId, -amount, reason, 'debit');
        return newBalance;
    }

    // === COMMANDES ÉCONOMIE ===

    async showBalance(interaction) {
        const userId = interaction.user.id;
        const balance = this.getBalance(userId);

        const embed = new EmbedBuilder()
            .setColor('#00ff88')
            .setTitle('💰 Votre Porte-monnaie')
            .setDescription(this.lang.t('economy.balance', { amount: balance.toLocaleString() }))
            .addFields(
                { name: '📊 Rang', value: this.getUserRank(userId), inline: true },
                { name: '💎 Niveau VIP', value: this.getVIPLevel(balance), inline: true }
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp();

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('daily_reward')
                    .setLabel('🎁 Quotidien')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('shop_view')
                    .setLabel('🛒 Boutique')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('leaderboard')
                    .setLabel('🏆 Classement')
                    .setStyle(ButtonStyle.Success)
            );

        await interaction.reply({ embeds: [embed], components: [actionRow] });
    }

    async claimDaily(interaction) {
        const userId = interaction.user.id;
        const today = new Date().toDateString();
        const lastClaim = this.dailyClaims.get(userId);

        if (lastClaim === today) {
            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('⏰ Récompense quotidienne')
                .setDescription(this.lang.t('economy.daily_claimed'))
                .setTimestamp();

            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Calculer la récompense
        const baseReward = 50;
        const streakBonus = this.getStreakBonus(userId);
        const vipBonus = this.getVIPBonus(userId);
        const totalReward = baseReward + streakBonus + vipBonus;

        // Donner les crédits
        const newBalance = this.addCredits(userId, totalReward, 'Récompense quotidienne');
        this.dailyClaims.set(userId, today);

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎁 Récompense quotidienne récupérée!')
            .setDescription(this.lang.t('economy.daily', { amount: totalReward.toLocaleString() }))
            .addFields(
                { name: '💰 Récompense de base', value: `${baseReward} crédits`, inline: true },
                { name: '🔥 Bonus série', value: `${streakBonus} crédits`, inline: true },
                { name: '👑 Bonus VIP', value: `${vipBonus} crédits`, inline: true },
                { name: '💎 Nouveau solde', value: `${newBalance.toLocaleString()} crédits`, inline: false }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    async showShop(interaction, category = 'all') {
        const items = Array.from(this.shopItems.values());
        const filteredItems = category === 'all' 
            ? items 
            : items.filter(item => item.category === category);

        if (filteredItems.length === 0) {
            return await interaction.reply({
                content: '❌ Aucun article trouvé dans cette catégorie.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#9932cc')
            .setTitle('🛒 Boutique FSProtect')
            .setDescription(this.lang.t('economy.shop'))
            .setTimestamp();

        // Ajouter les articles par catégorie
        const categories = {};
        for (const item of filteredItems) {
            if (!categories[item.category]) {
                categories[item.category] = [];
            }
            categories[item.category].push(item);
        }

        for (const [cat, catItems] of Object.entries(categories)) {
            const itemList = catItems.map(item => 
                `${item.emoji} **${item.name}** - ${item.price} crédits\n${item.description}`
            ).join('\n\n');
            
            embed.addFields({ 
                name: `${this.getCategoryEmoji(cat)} ${this.getCategoryName(cat)}`, 
                value: itemList, 
                inline: false 
            });
        }

        // Boutons de catégories
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('shop_obfuscation')
                    .setLabel('🔒 Obfuscation')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('shop_tools')
                    .setLabel('⚙️ Outils')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('shop_support')
                    .setLabel('🎫 Support')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('shop_cosmetic')
                    .setLabel('👑 Cosmétiques')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.reply({ embeds: [embed], components: [actionRow] });
    }

    async buyItem(interaction, itemId) {
        const userId = interaction.user.id;
        const item = this.shopItems.get(itemId);

        if (!item) {
            return await interaction.reply({
                content: '❌ Article non trouvé.',
                ephemeral: true
            });
        }

        if (!item.available) {
            return await interaction.reply({
                content: '❌ Cet article n\'est pas disponible actuellement.',
                ephemeral: true
            });
        }

        const balance = this.getBalance(userId);
        if (balance < item.price) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Fonds insuffisants')
                .setDescription(this.lang.t('economy.insufficient_funds'))
                .addFields(
                    { name: 'Prix requis', value: `${item.price.toLocaleString()} crédits`, inline: true },
                    { name: 'Votre solde', value: `${balance.toLocaleString()} crédits`, inline: true },
                    { name: 'Manquant', value: `${(item.price - balance).toLocaleString()} crédits`, inline: true }
                )
                .setTimestamp();

            return await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Confirmer l'achat
        const confirmEmbed = new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle('🛒 Confirmer l\'achat')
            .setDescription(`Voulez-vous acheter **${item.name}** pour **${item.price.toLocaleString()} crédits** ?`)
            .addFields(
                { name: 'Description', value: item.description, inline: false },
                { name: 'Solde actuel', value: `${balance.toLocaleString()} crédits`, inline: true },
                { name: 'Solde après achat', value: `${(balance - item.price).toLocaleString()} crédits`, inline: true }
            )
            .setTimestamp();

        const confirmRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`buy_confirm_${itemId}_${userId}`)
                    .setLabel('✅ Confirmer')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`buy_cancel_${userId}`)
                    .setLabel('❌ Annuler')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], ephemeral: true });
    }

    async confirmPurchase(interaction, itemId, userId) {
        if (interaction.user.id !== userId) {
            return await interaction.reply({
                content: '❌ Vous ne pouvez pas confirmer cet achat.',
                ephemeral: true
            });
        }

        const item = this.shopItems.get(itemId);
        const newBalance = this.removeCredits(userId, item.price, `Achat: ${item.name}`);

        if (newBalance === false) {
            return await interaction.reply({
                content: '❌ Fonds insuffisants.',
                ephemeral: true
            });
        }

        // Traiter l'achat selon le type d'article
        await this.processItemPurchase(interaction, item, userId);

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Achat réussi!')
            .setDescription(this.lang.t('economy.buy_success'))
            .addFields(
                { name: 'Article acheté', value: `${item.emoji} ${item.name}`, inline: true },
                { name: 'Prix payé', value: `${item.price.toLocaleString()} crédits`, inline: true },
                { name: 'Nouveau solde', value: `${newBalance.toLocaleString()} crédits`, inline: true }
            )
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });
    }

    async processItemPurchase(interaction, item, userId) {
        switch (item.category) {
            case 'obfuscation':
                await this.grantObfuscationCredits(userId, item);
                break;
            case 'support':
                await this.grantPrioritySupport(userId, item);
                break;
            case 'cosmetic':
                await this.grantCosmetic(interaction, userId, item);
                break;
            case 'tools':
                await this.grantTool(userId, item);
                break;
            case 'boost':
                await this.grantBoost(interaction, userId, item);
                break;
        }
    }

    async grantObfuscationCredits(userId, item) {
        // Ajouter des crédits d'obfuscation à l'utilisateur
        const database = require('./database.js');
        const credits = item.id === 'obfuscation_basic' ? 10 : 50;
        
        // Logique pour ajouter les crédits d'obfuscation
        console.log(`Granted ${credits} obfuscation credits to ${userId}`);
    }

    async grantPrioritySupport(userId, item) {
        // Ajouter le support prioritaire
        const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours
        console.log(`Granted priority support to ${userId} until ${expiryDate}`);
    }

    async grantCosmetic(interaction, userId, item) {
        // Donner un rôle cosmétique
        try {
            const member = await interaction.guild.members.fetch(userId);
            const role = interaction.guild.roles.cache.find(r => r.name === 'VIP FSProtect');
            
            if (role) {
                await member.roles.add(role);
                console.log(`Granted cosmetic role to ${userId}`);
            }
        } catch (error) {
            console.error('Erreur attribution rôle cosmétique:', error);
        }
    }

    async grantTool(userId, item) {
        // Débloquer des outils avancés
        console.log(`Granted tool ${item.id} to ${userId}`);
    }

    async grantBoost(interaction, userId, item) {
        // Booster le serveur
        console.log(`Granted server boost to ${userId}`);
    }

    async showLeaderboard(interaction) {
        const sortedUsers = Array.from(this.userBalances.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        if (sortedUsers.length === 0) {
            return await interaction.reply({
                content: '❌ Aucune donnée de classement disponible.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle('🏆 Classement des Plus Riches')
            .setDescription('Top 10 des utilisateurs avec le plus de crédits')
            .setTimestamp();

        let description = '';
        for (let i = 0; i < sortedUsers.length; i++) {
            const [userId, balance] = sortedUsers[i];
            const user = await interaction.client.users.fetch(userId).catch(() => null);
            const username = user ? user.username : 'Utilisateur inconnu';
            
            const medals = ['🥇', '🥈', '🥉'];
            const medal = medals[i] || `${i + 1}.`;
            
            description += `${medal} **${username}** - ${balance.toLocaleString()} crédits\n`;
        }

        embed.setDescription(description);

        // Position de l'utilisateur actuel
        const userPosition = Array.from(this.userBalances.entries())
            .sort((a, b) => b[1] - a[1])
            .findIndex(([id]) => id === interaction.user.id) + 1;

        if (userPosition > 0) {
            embed.addFields({
                name: 'Votre position',
                value: `#${userPosition} avec ${this.getBalance(interaction.user.id).toLocaleString()} crédits`,
                inline: false
            });
        }

        await interaction.reply({ embeds: [embed] });
    }

    // === UTILITAIRES ===

    getUserRank(userId) {
        const balance = this.getBalance(userId);
        
        if (balance >= 10000) return '💎 Diamant';
        if (balance >= 5000) return '🔥 Platine';
        if (balance >= 2000) return '⭐ Or';
        if (balance >= 1000) return '🥈 Argent';
        if (balance >= 500) return '🥉 Bronze';
        return '🆕 Débutant';
    }

    getVIPLevel(balance) {
        if (balance >= 50000) return 'VIP Ultime';
        if (balance >= 25000) return 'VIP Premium';
        if (balance >= 10000) return 'VIP Standard';
        return 'Membre Standard';
    }

    getStreakBonus(userId) {
        // Calculer le bonus de série quotidienne
        return 0; // Placeholder
    }

    getVIPBonus(userId) {
        const balance = this.getBalance(userId);
        if (balance >= 10000) return 50;
        if (balance >= 5000) return 25;
        if (balance >= 1000) return 10;
        return 0;
    }

    getCategoryEmoji(category) {
        const emojis = {
            obfuscation: '🔒',
            tools: '⚙️',
            support: '🎫',
            cosmetic: '👑',
            boost: '🚀'
        };
        return emojis[category] || '📦';
    }

    getCategoryName(category) {
        const names = {
            obfuscation: 'Obfuscation',
            tools: 'Outils',
            support: 'Support',
            cosmetic: 'Cosmétiques',
            boost: 'Boosts'
        };
        return names[category] || 'Divers';
    }

    logTransaction(userId, amount, reason, type) {
        const transactionId = Date.now() + '_' + userId;
        this.transactions.set(transactionId, {
            userId,
            amount,
            reason,
            type,
            timestamp: Date.now()
        });

        // Garder seulement les 1000 dernières transactions
        if (this.transactions.size > 1000) {
            const oldestKey = this.transactions.keys().next().value;
            this.transactions.delete(oldestKey);
        }
    }

    getTransactionHistory(userId, limit = 10) {
        const userTransactions = Array.from(this.transactions.values())
            .filter(t => t.userId === userId)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);

        return userTransactions;
    }

    getEconomyStats() {
        const stats = {
            totalUsers: this.userBalances.size,
            totalCredits: Array.from(this.userBalances.values()).reduce((a, b) => a + b, 0),
            richestUser: Math.max(...this.userBalances.values()),
            averageBalance: 0,
            totalTransactions: this.transactions.size
        };

        if (stats.totalUsers > 0) {
            stats.averageBalance = Math.round(stats.totalCredits / stats.totalUsers);
        }

        return stats;
    }
}

module.exports = EconomySystem;
