const { EmbedBuilder } = require('discord.js');

class AntiRaidSystem {
    constructor() {
        this.enabled = false;
        this.joinCount = new Map();
        this.messageCount = new Map();
        this.joinThreshold = 5; // Nombre maximum de joins en 10 secondes
        this.messageThreshold = 5; // Nombre maximum de messages en 5 secondes
        this.punishmentType = 'kick'; // 'kick' ou 'ban'
        this.whitelist = new Set();
    }

    start() {
        this.enabled = true;
        this.clearMaps();
        console.log('✅ Système anti-raid activé');
    }

    stop() {
        this.enabled = false;
        this.clearMaps();
        console.log('🛑 Système anti-raid désactivé');
    }

    clearMaps() {
        setInterval(() => {
            this.joinCount.clear();
            this.messageCount.clear();
        }, 10000);
    }

    async handleMemberJoin(member) {
        if (!this.enabled || this.whitelist.has(member.id)) return;

        const count = (this.joinCount.get(member.guild.id) || 0) + 1;
        this.joinCount.set(member.guild.id, count);

        if (count >= this.joinThreshold) {
            // Activer le mode raid
            await this.enableRaidMode(member.guild);
            
            if (this.punishmentType === 'kick') {
                await member.kick('Protection anti-raid');
            } else if (this.punishmentType === 'ban') {
                await member.ban({ reason: 'Protection anti-raid' });
            }
        }
    }

    async handleMessage(message) {
        if (!this.enabled || this.whitelist.has(message.author.id)) return;

        const key = `${message.guild.id}-${message.author.id}`;
        const count = (this.messageCount.get(key) || 0) + 1;
        this.messageCount.set(key, count);

        if (count >= this.messageThreshold) {
            await message.member.timeout(300000, 'Spam détecté'); // Timeout 5 minutes
            await message.channel.bulkDelete(
                (await message.channel.messages.fetch({ limit: 100 }))
                    .filter(m => m.author.id === message.author.id)
                    .first(this.messageThreshold)
            );
        }
    }

    async enableRaidMode(guild) {
        // Verrouiller tous les salons publics
        await Promise.all(guild.channels.cache.map(async channel => {
            if (channel.isTextBased()) {
                await channel.permissionOverwrites.edit(guild.roles.everyone, {
                    SendMessages: false
                });
            }
        }));

        // Notification aux modérateurs
        const logChannel = guild.channels.cache.find(c => 
            c.name === 'mod-logs' || c.name === 'logs' || c.name === 'raid-logs'
        );

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Mode Anti-Raid Activé')
                .setDescription('Une activité suspecte a été détectée.')
                .setColor('#ff0000')
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
        }
    }

    async handleCommand(interaction, subcommand, lang) {
        switch (subcommand) {
            case 'enable':
                this.start();
                await interaction.reply({
                    content: lang === 'fr' 
                        ? '✅ Protection anti-raid activée' 
                        : '✅ Anti-raid protection enabled',
                    ephemeral: true
                });
                break;

            case 'disable':
                this.stop();
                await interaction.reply({
                    content: lang === 'fr' 
                        ? '🛑 Protection anti-raid désactivée' 
                        : '🛑 Anti-raid protection disabled',
                    ephemeral: true
                });
                break;

            case 'settings':
                const embed = new EmbedBuilder()
                    .setTitle(lang === 'fr' ? '⚙️ Paramètres Anti-Raid' : '⚙️ Anti-Raid Settings')
                    .setColor('#0099ff')
                    .addFields(
                        {
                            name: lang === 'fr' ? 'État' : 'Status',
                            value: this.enabled ? '✅ Activé' : '❌ Désactivé',
                            inline: true
                        },
                        {
                            name: lang === 'fr' ? 'Type de punition' : 'Punishment Type',
                            value: this.punishmentType === 'kick' ? '👢 Kick' : '🔨 Ban',
                            inline: true
                        },
                        {
                            name: lang === 'fr' ? 'Seuil de joins' : 'Join Threshold',
                            value: `${this.joinThreshold}/10s`,
                            inline: true
                        },
                        {
                            name: lang === 'fr' ? 'Seuil de messages' : 'Message Threshold',
                            value: `${this.messageThreshold}/5s`,
                            inline: true
                        }
                    );

                await interaction.reply({ embeds: [embed], ephemeral: true });
                break;
        }
    }
}

module.exports = AntiRaidSystem;
