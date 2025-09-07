/**
 * Système de gestion des langues (FR/EN)
 */

class LanguageManager {
    constructor() {
        this.languages = {
            fr: {
                // Commandes générales
                'command.ping.description': 'Affiche la latence du bot',
                'command.ping.response': '🏓 Pong! Latence: {latency}ms',
                'command.help.description': 'Affiche la liste des commandes',
                'command.help.title': '📋 Aide - Commandes disponibles',
                
                // Système d'obfuscation
                'obfuscation.upload.description': 'Obfusquer un fichier de code',
                'obfuscation.success': '✅ Fichier obfusqué avec succès!',
                'obfuscation.error': '❌ Erreur lors de l\'obfuscation: {error}',
                'obfuscation.limit_reached': '❌ Limite quotidienne atteinte. Abonnez-vous pour plus!',
                'obfuscation.invalid_file': '❌ Type de fichier non supporté',
                
                // Système d'abonnements
                'subscription.info.description': 'Affiche vos informations d\'abonnement',
                'subscription.upgrade.description': 'Améliorer votre abonnement',
                'subscription.current': 'Abonnement actuel: **{plan}**',
                'subscription.files_used': 'Fichiers utilisés: {used}/{limit}',
                'subscription.expires': 'Expire le: {date}',
                'subscription.success': '✅ Abonnement activé avec succès!',
                
                // Système de paiement
                'payment.methods.title': '💳 Méthodes de paiement disponibles',
                'payment.ticket.created': '🎫 Ticket de paiement créé: {channel}',
                'payment.instructions': 'Suivez les instructions dans le ticket pour finaliser votre paiement.',
                'payment.confirmed': '✅ Paiement confirmé! Votre abonnement est maintenant actif.',
                
                // Administration
                'admin.panel.title': '⚙️ Panel d\'administration',
                'admin.unauthorized': '❌ Vous n\'avez pas les permissions d\'administration.',
                'admin.stats.users': 'Utilisateurs: {count}',
                'admin.stats.subscriptions': 'Abonnements actifs: {count}',
                
                // Erreurs générales
                'error.unknown': '❌ Une erreur inconnue s\'est produite',
                'error.permissions': '❌ Permissions insuffisantes',
                'error.cooldown': '❌ Veuillez attendre {time} secondes',
                
                // Succès
                'success.generic': '✅ Opération réalisée avec succès!'
            },
            en: {
                // General commands
                'command.ping.description': 'Shows bot latency',
                'command.ping.response': '🏓 Pong! Latency: {latency}ms',
                'command.help.description': 'Display command list',
                'command.help.title': '📋 Help - Available commands',
                
                // Obfuscation system
                'obfuscation.upload.description': 'Obfuscate a code file',
                'obfuscation.success': '✅ File obfuscated successfully!',
                'obfuscation.error': '❌ Error during obfuscation: {error}',
                'obfuscation.limit_reached': '❌ Daily limit reached. Subscribe for more!',
                'obfuscation.invalid_file': '❌ Unsupported file type',
                
                // Subscription system
                'subscription.info.description': 'Display your subscription information',
                'subscription.upgrade.description': 'Upgrade your subscription',
                'subscription.current': 'Current subscription: **{plan}**',
                'subscription.files_used': 'Files used: {used}/{limit}',
                'subscription.expires': 'Expires on: {date}',
                'subscription.success': '✅ Subscription activated successfully!',
                
                // Payment system
                'payment.methods.title': '💳 Available payment methods',
                'payment.ticket.created': '🎫 Payment ticket created: {channel}',
                'payment.instructions': 'Follow the instructions in the ticket to complete your payment.',
                'payment.confirmed': '✅ Payment confirmed! Your subscription is now active.',
                
                // Administration
                'admin.panel.title': '⚙️ Administration panel',
                'admin.unauthorized': '❌ You don\'t have administration permissions.',
                'admin.stats.users': 'Users: {count}',
                'admin.stats.subscriptions': 'Active subscriptions: {count}',
                
                // General errors
                'error.unknown': '❌ An unknown error occurred',
                'error.permissions': '❌ Insufficient permissions',
                'error.cooldown': '❌ Please wait {time} seconds',
                
                // Success
                'success.generic': '✅ Operation completed successfully!'
            }
        };
        
        this.userLanguages = new Map(); // userId -> language
        this.defaultLanguage = 'fr';
    }

    /**
     * Définit la langue d'un utilisateur
     */
    setUserLanguage(userId, language) {
        if (this.languages[language]) {
            this.userLanguages.set(userId, language);
            return true;
        }
        return false;
    }

    /**
     * Récupère la langue d'un utilisateur
     */
    getUserLanguage(userId) {
        return this.userLanguages.get(userId) || this.defaultLanguage;
    }

    /**
     * Traduit un message
     */
    translate(userId, key, replacements = {}) {
        const language = this.getUserLanguage(userId);
        let text = this.languages[language][key] || this.languages[this.defaultLanguage][key] || key;
        
        // Remplace les placeholders {variable}
        for (const [placeholder, value] of Object.entries(replacements)) {
            text = text.replace(new RegExp(`{${placeholder}}`, 'g'), value);
        }
        
        return text;
    }

    /**
     * Raccourci pour traduire
     */
    t(userId, key, replacements = {}) {
        return this.translate(userId, key, replacements);
    }

    /**
     * Récupère toutes les langues disponibles
     */
    getAvailableLanguages() {
        return Object.keys(this.languages);
    }

    /**
     * Sauvegarde les préférences de langue (peut être étendu avec une base de données)
     */
    saveLanguagePreferences() {
        // Pour l'instant, les préférences sont en mémoire
        // Peut être étendu pour sauvegarder en JSON ou base de données
        console.log('Préférences de langue sauvegardées pour', this.userLanguages.size, 'utilisateurs');
    }

    /**
     * Charge les préférences de langue
     */
    loadLanguagePreferences() {
        // Peut être étendu pour charger depuis JSON ou base de données
        console.log('Préférences de langue chargées');
    }
}

module.exports = LanguageManager;
