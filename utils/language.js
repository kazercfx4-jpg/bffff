const fs = require('fs');
const path = require('path');

class LanguageManager {
    constructor() {
        this.currentLanguage = 'fr';
        this.languages = new Map();
        this.fallbackLanguage = 'en';
        this.loadLanguages();
    }

    loadLanguages() {
        const langDir = path.join(__dirname, '..', 'languages');
        
        if (!fs.existsSync(langDir)) {
            fs.mkdirSync(langDir, { recursive: true });
        }

        // Charger tous les fichiers de langue
        try {
            const files = fs.readdirSync(langDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const langCode = file.replace('.json', '');
                    const langPath = path.join(langDir, file);
                    const translations = JSON.parse(fs.readFileSync(langPath, 'utf8'));
                    this.languages.set(langCode, translations);
                }
            }
        } catch (error) {
            console.error('Erreur chargement langues:', error);
        }

        // Créer les langues par défaut si elles n'existent pas
        this.createDefaultLanguages();
    }

    createDefaultLanguages() {
        // Français
        if (!this.languages.has('fr')) {
            this.languages.set('fr', this.getFrenchTranslations());
            this.saveLanguage('fr');
        }

        // Anglais
        if (!this.languages.has('en')) {
            this.languages.set('en', this.getEnglishTranslations());
            this.saveLanguage('en');
        }
    }

    getFrenchTranslations() {
        return {
            // Commandes générales
            commands: {
                obfuscate: {
                    name: 'obfusquer',
                    description: 'Obfusquer un fichier Lua',
                    file_option: 'Fichier Lua à obfusquer',
                    preset_option: 'Preset d\'obfuscation à utiliser',
                    success: 'Fichier obfusqué avec succès !',
                    error: 'Erreur lors de l\'obfuscation : {error}',
                    processing: 'Obfuscation en cours...',
                    no_access: 'Vous n\'avez pas accès à cette fonctionnalité.'
                },
                price: {
                    name: 'prix',
                    description: 'Voir les prix et abonnements',
                    title: '💎 Tarifs FSProtect',
                    basic: 'Basic - Gratuit',
                    premium: 'Premium - 9.99€/mois',
                    vip: 'VIP - 19.99€/mois'
                },
                help: {
                    name: 'aide',
                    description: 'Afficher l\'aide du bot',
                    title: '📖 Aide FSProtect',
                    categories: 'Catégories disponibles'
                },
                language: {
                    name: 'langue',
                    description: 'Changer la langue du bot',
                    option: 'Nouvelle langue',
                    changed: 'Langue changée vers {language}',
                    invalid: 'Langue non supportée'
                }
            },

            // Messages système
            system: {
                maintenance: 'Le bot est en mode maintenance. Raison : {reason}',
                error: 'Une erreur est survenue',
                no_permission: 'Vous n\'avez pas la permission d\'utiliser cette commande',
                cooldown: 'Veuillez attendre {time} avant de réutiliser cette commande',
                loading: 'Chargement...',
                success: 'Opération réussie',
                cancelled: 'Opération annulée'
            },

            // Modération
            moderation: {
                ban: {
                    name: 'bannir',
                    description: 'Bannir un utilisateur',
                    user_option: 'Utilisateur à bannir',
                    reason_option: 'Raison du bannissement',
                    success: '{user} a été banni avec succès',
                    error: 'Impossible de bannir cet utilisateur',
                    dm_message: 'Vous avez été banni de {guild} pour : {reason}'
                },
                kick: {
                    name: 'expulser',
                    description: 'Expulser un utilisateur',
                    success: '{user} a été expulsé avec succès',
                    dm_message: 'Vous avez été expulsé de {guild} pour : {reason}'
                },
                mute: {
                    name: 'mute',
                    description: 'Rendre muet un utilisateur',
                    duration_option: 'Durée du mute',
                    success: '{user} a été rendu muet pour {duration}',
                    dm_message: 'Vous avez été rendu muet sur {guild} pour : {reason}'
                },
                warn: {
                    name: 'avertir',
                    description: 'Avertir un utilisateur',
                    success: '{user} a reçu un avertissement',
                    dm_message: 'Vous avez reçu un avertissement sur {guild} pour : {reason}'
                },
                slowmode: {
                    name: 'slowmode',
                    description: 'Activer le mode lent',
                    duration_option: 'Durée en secondes',
                    success: 'Mode lent activé : {duration} secondes',
                    disabled: 'Mode lent désactivé'
                },
                lock: {
                    name: 'verrouiller',
                    description: 'Verrouiller un salon',
                    success: 'Salon verrouillé',
                    already_locked: 'Le salon est déjà verrouillé'
                },
                unlock: {
                    name: 'deverrouiller',
                    description: 'Déverrouiller un salon',
                    success: 'Salon déverrouillé',
                    not_locked: 'Le salon n\'est pas verrouillé'
                }
            },

            // IA Assistant
            ai: {
                thinking: '🤔 Réflexion en cours...',
                error: 'Désolé, je ne peux pas répondre pour le moment',
                no_question: 'Veuillez poser une question',
                help_categories: {
                    fivem: 'Questions FiveM',
                    lua: 'Programmation Lua',
                    bot: 'Utilisation du bot',
                    general: 'Questions générales'
                }
            },

            // Tickets
            tickets: {
                create: {
                    name: 'créer-ticket',
                    description: 'Créer un ticket de support',
                    category_option: 'Catégorie du problème',
                    reason_option: 'Description du problème',
                    success: 'Ticket créé : {channel}',
                    limit_reached: 'Vous avez atteint la limite de tickets ouverts'
                },
                close: {
                    name: 'fermer-ticket',
                    description: 'Fermer le ticket actuel',
                    reason_option: 'Raison de fermeture',
                    success: 'Ticket fermé avec succès',
                    not_ticket: 'Ce n\'est pas un salon de ticket'
                }
            },

            // Stats et info
            stats: {
                title: '📊 Statistiques FSProtect',
                server_info: 'Informations Serveur',
                bot_info: 'Informations Bot',
                usage: 'Utilisation',
                performance: 'Performance'
            },

            // Économie
            economy: {
                balance: 'Solde : {amount} crédits',
                daily: 'Récompense quotidienne récupérée : +{amount} crédits',
                daily_claimed: 'Récompense déjà récupérée aujourd\'hui',
                shop: 'Boutique FSProtect',
                buy_success: 'Achat effectué avec succès',
                insufficient_funds: 'Crédits insuffisants'
            }
        };
    }

    getEnglishTranslations() {
        return {
            // General commands
            commands: {
                obfuscate: {
                    name: 'obfuscate',
                    description: 'Obfuscate a Lua file',
                    file_option: 'Lua file to obfuscate',
                    preset_option: 'Obfuscation preset to use',
                    success: 'File obfuscated successfully!',
                    error: 'Error during obfuscation: {error}',
                    processing: 'Obfuscation in progress...',
                    no_access: 'You don\'t have access to this feature.'
                },
                price: {
                    name: 'price',
                    description: 'View prices and subscriptions',
                    title: '💎 FSProtect Pricing',
                    basic: 'Basic - Free',
                    premium: 'Premium - $9.99/month',
                    vip: 'VIP - $19.99/month'
                },
                help: {
                    name: 'help',
                    description: 'Show bot help',
                    title: '📖 FSProtect Help',
                    categories: 'Available categories'
                },
                language: {
                    name: 'language',
                    description: 'Change bot language',
                    option: 'New language',
                    changed: 'Language changed to {language}',
                    invalid: 'Unsupported language'
                }
            },

            // System messages
            system: {
                maintenance: 'Bot is in maintenance mode. Reason: {reason}',
                error: 'An error occurred',
                no_permission: 'You don\'t have permission to use this command',
                cooldown: 'Please wait {time} before using this command again',
                loading: 'Loading...',
                success: 'Operation successful',
                cancelled: 'Operation cancelled'
            },

            // Moderation
            moderation: {
                ban: {
                    name: 'ban',
                    description: 'Ban a user',
                    user_option: 'User to ban',
                    reason_option: 'Ban reason',
                    success: '{user} has been banned successfully',
                    error: 'Cannot ban this user',
                    dm_message: 'You have been banned from {guild} for: {reason}'
                },
                kick: {
                    name: 'kick',
                    description: 'Kick a user',
                    success: '{user} has been kicked successfully',
                    dm_message: 'You have been kicked from {guild} for: {reason}'
                },
                mute: {
                    name: 'mute',
                    description: 'Mute a user',
                    duration_option: 'Mute duration',
                    success: '{user} has been muted for {duration}',
                    dm_message: 'You have been muted on {guild} for: {reason}'
                },
                warn: {
                    name: 'warn',
                    description: 'Warn a user',
                    success: '{user} has received a warning',
                    dm_message: 'You received a warning on {guild} for: {reason}'
                },
                slowmode: {
                    name: 'slowmode',
                    description: 'Enable slow mode',
                    duration_option: 'Duration in seconds',
                    success: 'Slow mode enabled: {duration} seconds',
                    disabled: 'Slow mode disabled'
                },
                lock: {
                    name: 'lock',
                    description: 'Lock a channel',
                    success: 'Channel locked',
                    already_locked: 'Channel is already locked'
                },
                unlock: {
                    name: 'unlock',
                    description: 'Unlock a channel',
                    success: 'Channel unlocked',
                    not_locked: 'Channel is not locked'
                }
            },

            // AI Assistant
            ai: {
                thinking: '🤔 Thinking...',
                error: 'Sorry, I can\'t respond right now',
                no_question: 'Please ask a question',
                help_categories: {
                    fivem: 'FiveM Questions',
                    lua: 'Lua Programming',
                    bot: 'Bot Usage',
                    general: 'General Questions'
                }
            },

            // Tickets
            tickets: {
                create: {
                    name: 'create-ticket',
                    description: 'Create a support ticket',
                    category_option: 'Issue category',
                    reason_option: 'Problem description',
                    success: 'Ticket created: {channel}',
                    limit_reached: 'You have reached the open tickets limit'
                },
                close: {
                    name: 'close-ticket',
                    description: 'Close current ticket',
                    reason_option: 'Closing reason',
                    success: 'Ticket closed successfully',
                    not_ticket: 'This is not a ticket channel'
                }
            },

            // Stats and info
            stats: {
                title: '📊 FSProtect Statistics',
                server_info: 'Server Information',
                bot_info: 'Bot Information',
                usage: 'Usage',
                performance: 'Performance'
            },

            // Economy
            economy: {
                balance: 'Balance: {amount} credits',
                daily: 'Daily reward claimed: +{amount} credits',
                daily_claimed: 'Daily reward already claimed today',
                shop: 'FSProtect Shop',
                buy_success: 'Purchase successful',
                insufficient_funds: 'Insufficient credits'
            }
        };
    }

    saveLanguage(langCode) {
        try {
            const langDir = path.join(__dirname, '..', 'languages');
            const langPath = path.join(langDir, `${langCode}.json`);
            const translations = this.languages.get(langCode);
            
            if (translations) {
                fs.writeFileSync(langPath, JSON.stringify(translations, null, 2));
            }
        } catch (error) {
            console.error(`Erreur sauvegarde langue ${langCode}:`, error);
        }
    }

    setLanguage(langCode) {
        if (this.languages.has(langCode)) {
            this.currentLanguage = langCode;
            return true;
        }
        return false;
    }

    getLanguage() {
        return this.currentLanguage;
    }

    getAvailableLanguages() {
        return Array.from(this.languages.keys());
    }

    translate(key, replacements = {}, langCode = null) {
        const lang = langCode || this.currentLanguage;
        const translations = this.languages.get(lang) || this.languages.get(this.fallbackLanguage);
        
        if (!translations) {
            return key;
        }

        // Naviguer dans l'objet de traductions avec la clé
        const keys = key.split('.');
        let value = translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return key; // Clé non trouvée
            }
        }

        if (typeof value !== 'string') {
            return key;
        }

        // Remplacer les variables dans la traduction
        let result = value;
        for (const [placeholder, replacement] of Object.entries(replacements)) {
            result = result.replace(new RegExp(`{${placeholder}}`, 'g'), replacement);
        }

        return result;
    }

    // Alias pour une utilisation plus simple
    t(key, replacements = {}, langCode = null) {
        return this.translate(key, replacements, langCode);
    }

    // Obtenir toutes les traductions pour une langue
    getTranslations(langCode = null) {
        const lang = langCode || this.currentLanguage;
        return this.languages.get(lang) || {};
    }

    // Ajouter ou mettre à jour une traduction
    addTranslation(langCode, key, value) {
        if (!this.languages.has(langCode)) {
            this.languages.set(langCode, {});
        }

        const translations = this.languages.get(langCode);
        const keys = key.split('.');
        let current = translations;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!current[k] || typeof current[k] !== 'object') {
                current[k] = {};
            }
            current = current[k];
        }

        current[keys[keys.length - 1]] = value;
        this.saveLanguage(langCode);
    }

    // Supprimer une traduction
    removeTranslation(langCode, key) {
        const translations = this.languages.get(langCode);
        if (!translations) return false;

        const keys = key.split('.');
        let current = translations;

        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!current[k] || typeof current[k] !== 'object') {
                return false;
            }
            current = current[k];
        }

        delete current[keys[keys.length - 1]];
        this.saveLanguage(langCode);
        return true;
    }

    // Obtenir les statistiques de traduction
    getTranslationStats() {
        const stats = {};
        const baseKeys = this.getTranslationKeys(this.languages.get(this.fallbackLanguage));

        for (const [langCode, translations] of this.languages) {
            const langKeys = this.getTranslationKeys(translations);
            const completion = (langKeys.length / baseKeys.length) * 100;
            
            stats[langCode] = {
                total: baseKeys.length,
                translated: langKeys.length,
                completion: Math.round(completion * 100) / 100,
                missing: baseKeys.filter(key => !langKeys.includes(key))
            };
        }

        return stats;
    }

    // Obtenir toutes les clés de traduction de manière récursive
    getTranslationKeys(obj, prefix = '') {
        let keys = [];
        
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            
            if (typeof value === 'object' && value !== null) {
                keys = keys.concat(this.getTranslationKeys(value, fullKey));
            } else {
                keys.push(fullKey);
            }
        }
        
        return keys;
    }

    // Rechercher dans les traductions
    search(query, langCode = null) {
        const lang = langCode || this.currentLanguage;
        const translations = this.languages.get(lang);
        if (!translations) return [];

        const results = [];
        const searchKeys = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                
                if (typeof value === 'object' && value !== null) {
                    searchKeys(value, fullKey);
                } else if (typeof value === 'string') {
                    if (value.toLowerCase().includes(query.toLowerCase()) ||
                        fullKey.toLowerCase().includes(query.toLowerCase())) {
                        results.push({
                            key: fullKey,
                            value: value
                        });
                    }
                }
            }
        };

        searchKeys(translations);
        return results;
    }
}

module.exports = LanguageManager;
