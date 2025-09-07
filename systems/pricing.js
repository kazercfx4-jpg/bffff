const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

class PricingSystem {
    constructor(languageManager) {
        this.lang = languageManager;
        this.plans = this.initializePlans();
        this.features = this.initializeFeatures();
    }

    initializePlans() {
        return {
            basic: {
                id: 'basic',
                name: 'Basic',
                price: 0,
                currency: '€',
                period: 'gratuit',
                color: '#95a5a6',
                emoji: '🆓',
                popular: false,
                features: [
                    'obfuscation_basic',
                    'community_support',
                    'basic_presets',
                    'file_limit_small'
                ],
                limits: {
                    filesPerDay: 5,
                    maxFileSize: '1MB',
                    techniques: 10
                }
            },
            premium: {
                id: 'premium',
                name: 'Premium',
                price: 9.99,
                currency: '€',
                period: 'mois',
                color: '#3498db',
                emoji: '💎',
                popular: true,
                features: [
                    'obfuscation_advanced',
                    'priority_support',
                    'advanced_presets',
                    'file_limit_medium',
                    'custom_protection',
                    'performance_optimization',
                    'discord_integration'
                ],
                limits: {
                    filesPerDay: 100,
                    maxFileSize: '10MB',
                    techniques: 30
                }
            },
            vip: {
                id: 'vip',
                name: 'VIP',
                price: 19.99,
                currency: '€',
                period: 'mois',
                color: '#f39c12',
                emoji: '👑',
                popular: false,
                features: [
                    'obfuscation_military',
                    'vip_support',
                    'unlimited_presets',
                    'file_limit_unlimited',
                    'custom_protection',
                    'performance_optimization',
                    'discord_integration',
                    'ai_assistant',
                    'custom_branding',
                    'api_access',
                    'priority_queue',
                    'exclusive_features'
                ],
                limits: {
                    filesPerDay: 'unlimited',
                    maxFileSize: '100MB',
                    techniques: 50
                }
            },
            enterprise: {
                id: 'enterprise',
                name: 'Enterprise',
                price: 'Sur devis',
                currency: '',
                period: '',
                color: '#9b59b6',
                emoji: '🏢',
                popular: false,
                features: [
                    'everything_vip',
                    'dedicated_support',
                    'custom_solutions',
                    'team_management',
                    'advanced_analytics',
                    'white_label',
                    'sla_guarantee',
                    'on_premise'
                ],
                limits: {
                    filesPerDay: 'unlimited',
                    maxFileSize: 'unlimited',
                    techniques: 'unlimited'
                }
            }
        };
    }

    initializeFeatures() {
        return {
            // Obfuscation
            obfuscation_basic: {
                name: 'Obfuscation Basic',
                description: 'Protection de base pour vos scripts Lua',
                emoji: '🔒'
            },
            obfuscation_advanced: {
                name: 'Obfuscation Avancée',
                description: 'Protection renforcée avec 30+ techniques',
                emoji: '🛡️'
            },
            obfuscation_military: {
                name: 'Protection Militaire',
                description: 'Sécurité ultime avec 50+ techniques avancées',
                emoji: '⚔️'
            },
            
            // Support
            community_support: {
                name: 'Support Communautaire',
                description: 'Aide via Discord et documentation',
                emoji: '💬'
            },
            priority_support: {
                name: 'Support Prioritaire',
                description: 'Réponse sous 24h, support ticket dédié',
                emoji: '🎫'
            },
            vip_support: {
                name: 'Support VIP',
                description: 'Réponse sous 4h, chat direct, appels vidéo',
                emoji: '👑'
            },
            dedicated_support: {
                name: 'Support Dédié',
                description: 'Manager dédié, SLA garanti, support 24/7',
                emoji: '🏢'
            },
            
            // Presets
            basic_presets: {
                name: '5 Presets Basic',
                description: 'Presets d\'obfuscation prédéfinis',
                emoji: '📋'
            },
            advanced_presets: {
                name: '20 Presets Avancés',
                description: 'Presets optimisés pour différents cas',
                emoji: '📚'
            },
            unlimited_presets: {
                name: 'Presets Illimités',
                description: 'Créez et sauvegardez vos propres presets',
                emoji: '♾️'
            },
            
            // Limites de fichiers
            file_limit_small: {
                name: '5 fichiers/jour',
                description: 'Limite quotidienne de traitement',
                emoji: '📄'
            },
            file_limit_medium: {
                name: '100 fichiers/jour',
                description: 'Limite étendue pour projets moyens',
                emoji: '📁'
            },
            file_limit_unlimited: {
                name: 'Fichiers illimités',
                description: 'Aucune limite de traitement',
                emoji: '🗂️'
            },
            
            // Fonctionnalités avancées
            custom_protection: {
                name: 'Protection Personnalisée',
                description: 'Algorithmes adaptés à vos besoins',
                emoji: '🎨'
            },
            performance_optimization: {
                name: 'Optimisation Performance',
                description: 'Code obfusqué optimisé pour la vitesse',
                emoji: '⚡'
            },
            discord_integration: {
                name: 'Intégration Discord',
                description: 'Commandes avancées et notifications',
                emoji: '🔗'
            },
            ai_assistant: {
                name: 'Assistant IA',
                description: 'IA personnalisée pour vos questions',
                emoji: '🤖'
            },
            custom_branding: {
                name: 'Marque Personnalisée',
                description: 'Vos couleurs et logo dans l\'interface',
                emoji: '🎨'
            },
            api_access: {
                name: 'Accès API',
                description: 'Intégrez FSProtect dans vos outils',
                emoji: '🔌'
            },
            priority_queue: {
                name: 'File Prioritaire',
                description: 'Traitement prioritaire de vos fichiers',
                emoji: '🚀'
            },
            exclusive_features: {
                name: 'Fonctionnalités Exclusives',
                description: 'Accès aux nouvelles features en avant-première',
                emoji: '✨'
            },
            
            // Enterprise uniquement
            everything_vip: {
                name: 'Tout VIP inclus',
                description: 'Toutes les fonctionnalités VIP + bonus',
                emoji: '💼'
            },
            custom_solutions: {
                name: 'Solutions Sur Mesure',
                description: 'Développement spécifique à vos besoins',
                emoji: '🛠️'
            },
            team_management: {
                name: 'Gestion d\'Équipe',
                description: 'Comptes multiples, rôles, permissions',
                emoji: '👥'
            },
            advanced_analytics: {
                name: 'Analytics Avancées',
                description: 'Statistiques détaillées et rapports',
                emoji: '📊'
            },
            white_label: {
                name: 'Marque Blanche',
                description: 'Solution complète sous votre marque',
                emoji: '🏷️'
            },
            sla_guarantee: {
                name: 'SLA Garanti',
                description: 'Disponibilité 99.9% garantie',
                emoji: '📋'
            },
            on_premise: {
                name: 'Déploiement On-Premise',
                description: 'Installation sur vos serveurs',
                emoji: '🏗️'
            }
        };
    }

    async showPricing(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('💎 Tarifs FSProtect')
            .setDescription('Choisissez le plan qui correspond à vos besoins')
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setTimestamp();

        // Créer le menu de sélection des plans
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('pricing_plan_select')
            .setPlaceholder('🔍 Sélectionner un plan pour plus de détails')
            .addOptions(
                Object.values(this.plans).map(plan => ({
                    label: `${plan.emoji} ${plan.name}`,
                    description: plan.price === 0 
                        ? 'Plan gratuit avec fonctionnalités de base'
                        : typeof plan.price === 'string'
                        ? 'Solution entreprise personnalisée'
                        : `${plan.price}${plan.currency}/${plan.period}`,
                    value: plan.id
                }))
            );

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        // Boutons d'action
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('pricing_compare')
                    .setLabel('📊 Comparer les plans')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('pricing_contact')
                    .setLabel('📞 Nous contacter')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setURL('https://fsprotect.fr/pricing')
                    .setLabel('🌐 Site web')
                    .setStyle(ButtonStyle.Link)
            );

        // Aperçu rapide des plans
        let quickOverview = '';
        for (const plan of Object.values(this.plans)) {
            const priceText = plan.price === 0 
                ? 'Gratuit'
                : typeof plan.price === 'string'
                ? plan.price
                : `${plan.price}${plan.currency}/${plan.period}`;
            
            const popularBadge = plan.popular ? ' 🔥' : '';
            quickOverview += `${plan.emoji} **${plan.name}** - ${priceText}${popularBadge}\n`;
        }

        embed.addFields({ 
            name: '📋 Aperçu des Plans', 
            value: quickOverview, 
            inline: false 
        });

        await interaction.reply({ 
            embeds: [embed], 
            components: [selectRow, actionRow] 
        });
    }

    async showPlanDetails(interaction, planId) {
        const plan = this.plans[planId];
        if (!plan) {
            return await interaction.reply({
                content: '❌ Plan non trouvé.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor(plan.color)
            .setTitle(`${plan.emoji} Plan ${plan.name}`)
            .setTimestamp();

        // Prix et période
        if (plan.price === 0) {
            embed.setDescription('**Gratuit** - Parfait pour commencer');
        } else if (typeof plan.price === 'string') {
            embed.setDescription(`**${plan.price}** - Solution personnalisée`);
        } else {
            const popularBadge = plan.popular ? ' 🔥 **POPULAIRE**' : '';
            embed.setDescription(`**${plan.price}${plan.currency}/${plan.period}**${popularBadge}`);
        }

        // Fonctionnalités incluses
        const includedFeatures = plan.features.map(featureId => {
            const feature = this.features[featureId];
            return feature ? `${feature.emoji} ${feature.name}` : featureId;
        }).join('\n');

        embed.addFields({ 
            name: '✅ Fonctionnalités incluses', 
            value: includedFeatures, 
            inline: false 
        });

        // Limites
        if (plan.limits) {
            let limitsText = '';
            if (plan.limits.filesPerDay) {
                limitsText += `📄 **Fichiers/jour:** ${plan.limits.filesPerDay}\n`;
            }
            if (plan.limits.maxFileSize) {
                limitsText += `📦 **Taille max:** ${plan.limits.maxFileSize}\n`;
            }
            if (plan.limits.techniques) {
                limitsText += `🔧 **Techniques:** ${plan.limits.techniques}`;
            }
            
            if (limitsText) {
                embed.addFields({ 
                    name: '📊 Limites', 
                    value: limitsText, 
                    inline: true 
                });
            }
        }

        // Cas d'usage recommandés
        const useCases = this.getUseCases(planId);
        if (useCases) {
            embed.addFields({ 
                name: '🎯 Recommandé pour', 
                value: useCases, 
                inline: true 
            });
        }

        // Boutons d'action
        const actionRow = new ActionRowBuilder();
        
        if (plan.price === 0) {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('start_free_plan')
                    .setLabel('🚀 Commencer gratuitement')
                    .setStyle(ButtonStyle.Success)
            );
        } else if (typeof plan.price === 'string') {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('contact_enterprise')
                    .setLabel('📞 Contacter les ventes')
                    .setStyle(ButtonStyle.Primary)
            );
        } else {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`subscribe_${planId}`)
                    .setLabel(`💳 S'abonner - ${plan.price}€`)
                    .setStyle(ButtonStyle.Success)
            );
        }

        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId('pricing_back')
                .setLabel('🔙 Retour')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ 
            embeds: [embed], 
            components: [actionRow],
            ephemeral: true 
        });
    }

    async showComparison(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('📊 Comparaison des Plans')
            .setDescription('Tableau comparatif de toutes les fonctionnalités')
            .setTimestamp();

        // Créer le tableau de comparaison
        const plans = Object.values(this.plans);
        const mainFeatures = [
            'obfuscation_basic',
            'obfuscation_advanced',
            'obfuscation_military',
            'community_support',
            'priority_support',
            'vip_support',
            'ai_assistant',
            'api_access',
            'custom_protection'
        ];

        let comparisonText = '```\n';
        comparisonText += 'Fonctionnalité'.padEnd(20) + ' | ';
        comparisonText += plans.map(p => p.name.padEnd(10)).join(' | ') + '\n';
        comparisonText += '-'.repeat(20 + (plans.length * 13)) + '\n';

        for (const featureId of mainFeatures) {
            const feature = this.features[featureId];
            if (!feature) continue;

            comparisonText += feature.name.substring(0, 19).padEnd(20) + ' | ';
            
            for (const plan of plans) {
                const hasFeature = plan.features.includes(featureId);
                const symbol = hasFeature ? '✅' : '❌';
                comparisonText += symbol.padEnd(10) + ' | ';
            }
            comparisonText += '\n';
        }
        comparisonText += '```';

        embed.setDescription(comparisonText);

        // Ajouter les prix
        let pricingText = '';
        for (const plan of plans) {
            const priceText = plan.price === 0 
                ? 'Gratuit'
                : typeof plan.price === 'string'
                ? plan.price
                : `${plan.price}€/${plan.period}`;
            
            pricingText += `${plan.emoji} **${plan.name}:** ${priceText}\n`;
        }

        embed.addFields({ 
            name: '💰 Tarifs', 
            value: pricingText, 
            inline: false 
        });

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('pricing_back')
                    .setLabel('🔙 Retour aux tarifs')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('pricing_help')
                    .setLabel('❓ Aide au choix')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.reply({ 
            embeds: [embed], 
            components: [actionRow],
            ephemeral: true 
        });
    }

    async showPlanRecommendation(interaction) {
        // Créer un questionnaire pour recommander le bon plan
        const embed = new EmbedBuilder()
            .setColor('#9932cc')
            .setTitle('🎯 Aide au Choix de Plan')
            .setDescription('Répondez à quelques questions pour trouver le plan idéal')
            .addFields(
                { 
                    name: '🤔 Questions à considérer', 
                    value: '• Combien de fichiers traitez-vous par jour ?\n• Avez-vous besoin de support prioritaire ?\n• Travaillez-vous sur des projets sensibles ?\n• Utilisez-vous des outils externes ?', 
                    inline: false 
                },
                {
                    name: '💡 Recommandations rapides',
                    value: '🆓 **Basic** - Tests et petits projets\n💎 **Premium** - Projets professionnels\n👑 **VIP** - Équipes et gros volumes\n🏢 **Enterprise** - Grandes organisations',
                    inline: false
                }
            )
            .setTimestamp();

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('recommend_basic')
                    .setLabel('🆓 Je débute')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('recommend_premium')
                    .setLabel('💎 Usage pro')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('recommend_vip')
                    .setLabel('👑 Gros volumes')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('recommend_enterprise')
                    .setLabel('🏢 Entreprise')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.reply({ 
            embeds: [embed], 
            components: [actionRow],
            ephemeral: true 
        });
    }

    getUseCases(planId) {
        const useCases = {
            basic: '• Découverte de l\'obfuscation\n• Petits scripts personnels\n• Tests et apprentissage',
            premium: '• Projets FiveM professionnels\n• Développeurs indépendants\n• Scripts commerciaux',
            vip: '• Équipes de développement\n• Gros serveurs FiveM\n• Projets à haute valeur',
            enterprise: '• Grandes organisations\n• Solutions sur mesure\n• Déploiements à grande échelle'
        };

        return useCases[planId] || '';
    }

    async handleSubscription(interaction, planId) {
        const plan = this.plans[planId];
        if (!plan || plan.price === 0) {
            return await interaction.reply({
                content: '❌ Plan invalide.',
                ephemeral: true
            });
        }

        // Créer l'embed de processus d'abonnement
        const embed = new EmbedBuilder()
            .setColor(plan.color)
            .setTitle(`💳 Abonnement ${plan.name}`)
            .setDescription(`Processus d'abonnement pour le plan **${plan.name}**`)
            .addFields(
                { 
                    name: '💰 Prix', 
                    value: `${plan.price}${plan.currency}/${plan.period}`, 
                    inline: true 
                },
                { 
                    name: '🔄 Renouvellement', 
                    value: 'Automatique (résiliable)', 
                    inline: true 
                },
                { 
                    name: '✅ Activation', 
                    value: 'Immédiate', 
                    inline: true 
                }
            )
            .setTimestamp();

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setURL('https://fsprotect.fr/checkout/' + planId)
                    .setLabel('💳 Payer avec Stripe')
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setCustomId('payment_paypal')
                    .setLabel('🟡 PayPal')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('payment_crypto')
                    .setLabel('₿ Crypto')
                    .setStyle(ButtonStyle.Success)
            );

        await interaction.reply({ 
            embeds: [embed], 
            components: [actionRow],
            ephemeral: true 
        });
    }

    async handleFreePlanStart(interaction) {
        const database = require('./database.js');
        
        // Donner l'accès Basic à l'utilisateur
        await database.addUserAccess(interaction.user.id, 'basic');

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎉 Bienvenue chez FSProtect!')
            .setDescription('Votre plan Basic gratuit est maintenant actif!')
            .addFields(
                { 
                    name: '🚀 Premiers pas', 
                    value: '• Utilisez `/obfusquer` pour protéger vos scripts\n• Consultez `/aide` pour voir toutes les commandes\n• Rejoignez notre Discord pour du support', 
                    inline: false 
                },
                { 
                    name: '⏫ Upgrade', 
                    value: 'Passez Premium quand vous voulez avec `/prix`', 
                    inline: false 
                }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    getFAQ() {
        return {
            'Puis-je changer de plan ?': 'Oui, vous pouvez upgrader ou downgrader à tout moment. Les changements prennent effet immédiatement.',
            'Y a-t-il un engagement ?': 'Non, tous nos abonnements sont sans engagement. Vous pouvez annuler à tout moment.',
            'Que se passe-t-il si j\'annule ?': 'Votre accès reste actif jusqu\'à la fin de la période payée, puis vous repassez en Basic.',
            'Les prix incluent-ils la TVA ?': 'Les prix affichés sont HT. La TVA sera ajoutée selon votre localisation.',
            'Puis-je avoir une facture ?': 'Oui, toutes les factures sont disponibles dans votre espace client.',
            'Offrez-vous des réductions ?': 'Nous proposons des réductions pour les étudiants, les ONG et les abonnements annuels.'
        };
    }

    async showFAQ(interaction) {
        const faq = this.getFAQ();
        
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('❓ Questions Fréquentes')
            .setDescription('Réponses aux questions les plus courantes')
            .setTimestamp();

        for (const [question, answer] of Object.entries(faq)) {
            embed.addFields({ name: question, value: answer, inline: false });
        }

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('pricing_back')
                    .setLabel('🔙 Retour aux tarifs')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('contact_support')
                    .setLabel('💬 Autre question')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.reply({ 
            embeds: [embed], 
            components: [actionRow],
            ephemeral: true 
        });
    }

    // Calculateur de ROI pour les entreprises
    async showROICalculator(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#9932cc')
            .setTitle('📊 Calculateur de ROI')
            .setDescription('Calculez le retour sur investissement de FSProtect')
            .addFields(
                {
                    name: '💰 Économies typiques',
                    value: '• **Temps de développement:** -70%\n• **Coûts de sécurité:** -60%\n• **Maintenance:** -50%',
                    inline: true
                },
                {
                    name: '📈 Bénéfices',
                    value: '• Protection garantie\n• Support expert\n• Mises à jour continues\n• Conformité assurée',
                    inline: true
                },
                {
                    name: '🔢 Exemple concret',
                    value: 'Serveur avec 1000 joueurs:\n• Revenus protégés: ~50k€/an\n• Coût FSProtect: 240€/an\n• **ROI: 20,000%**',
                    inline: false
                }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

module.exports = PricingSystem;
