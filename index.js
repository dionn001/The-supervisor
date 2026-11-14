const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const express = require('express');

// Express server zodat Render de bot online houdt
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('GuardBot is alive and running!'));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

const OWNER_ID = '1140339824335786065';
const PREFIX = '!';

client.once('ready', () => {
    console.log(`Ingelogd als ${client.user.tag}! Bot is volledig operationeel.`);
    client.user.setActivity('server protection', { type: 3 });
});

// Automatische beveiligingen & commando handler
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // 1. Anti-Link beveiliging
    if (message.content.includes('http://') || message.content.includes('https://') || message.content.includes('www.')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            try {
                await message.delete();
                const warning = await message.channel.send(`⚠️ ${message.author}, links sturen is niet toegestaan in deze server!`);
                setTimeout(() => warning.delete().catch(() => {}), 5000);
                return;
            } catch (err) {
                console.error("Kon bericht niet verwijderen:", err);
            }
        }
    }

    // 2. Commando verwerking (start met '!')
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Commando: !help
    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ GuardBot Beveiliging & Commando\'s')
            .setColor(0x38bdf8)
            .setDescription('Hier is een overzicht van alle beschikbare commando\'s:')
            .addFields(
                { name: '!ban @gebruiker', value: 'Verban een gebruiker permanent van de server.', inline: false },
                { name: '!kick @gebruiker', value: 'Schop een gebruiker uit de server.', inline: false },
                { name: '!clear [aantal]', value: 'Verwijder een aantal berichten tegelijk (1-100).', inline: false },
                { name: '!lockdown', value: 'Beveilig de server direct tegen massale raids.', inline: false },
                { name: '!ticket', value: 'Open een privégesprek met de moderatoren.', inline: false },
                { name: '!ownerlock', value: 'Exclusieve beveiligingscheck voor de hoofdeigenaar.', inline: false }
            )
            .setFooter({ text: 'GuardBot Server Protection' });

        return message.channel.send({ embeds: [embed] });
    }

    // Commando: !ban
    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply('❌ Je hebt geen rechten om dit commando te gebruiken (`Ban Members` vereist).');
        }
        const member = message.mentions.members.first();
        if (!member) return message.reply('⚠️ Vermeld alstublieft een geldige gebruiker om te bannen (`!ban @naam`).');
        
        try {
            await member.ban({ reason: `Geband door ${message.author.tag}` });
            message.channel.send(`✅ **${member.user.tag}** is succesvol verbannen uit de server.`);
        } catch (err) {
            message.reply('❌ Het is niet gelukt om deze gebruiker te bannen (mogelijk heeft de bot te weinig rechten).');
        }
    }

    // Commando: !kick
    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return message.reply('❌ Je hebt geen rechten om dit commando te gebruiken (`Kick Members` vereist).');
        }
        const member = message.mentions.members.first();
        if (!member) return message.reply('⚠️ Vermeld alstublieft een geldige gebruiker om te kicken (`!kick @naam`).');
        
        try {
            await member.kick(`Gekicked door ${message.author.tag}`);
            message.channel.send(`✅ **${member.user.tag}** is succesvol gekicked uit de server.`);
        } catch (err) {
            message.reply('❌ Het is niet gelukt om deze gebruiker te kicken.');
        }
    }

    // Commando: !clear (berichten opschonen)
    if (command === 'clear') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ Je hebt geen rechten om berichten te wissen (`Manage Messages` vereist).');
        }
        const count = parseInt(args[0]);
        if (isNaN(count) || count < 1 || count > 100) {
            return message.reply('⚠️ Geef een getal op tussen 1 en 100 (`!clear 50`).');
        }

        try {
            await message.channel.bulkDelete(count, true);
            const confirmation = await message.channel.send(`🧹 Er zijn **${count}** berichten opgeschoond.`);
            setTimeout(() => confirmation.delete().catch(() => {}), 4000);
        } catch (err) {
            message.reply('❌ Berichten ouder dan 14 dagen kunnen niet in bulk worden verwijderd.');
        }
    }

    // Commando: !lockdown (Anti-Raid beveiliging)
    if (command === 'lockdown') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Alleen beheerders kunnen de lockdown activeren.');
        }

        try {
            await message.guild.channels.cache.forEach(async (channel) => {
                if (channel.type === ChannelType.GuildText) {
                    await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
                }
            });
            message.channel.send('🔒 **SERVER LOCKDOWN GEACTIVEERD!** Alle tekstkanalen zijn tijdelijk op slot gezet tegen raids.');
        } catch (err) {
            message.reply('❌ Er is een fout opgetreden bij het activeren van de lockdown.');
        }
    }

    // Commando: !ticket (Ticketsysteem met knop)
    if (command === 'ticket') {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Ondersteuning / Support Tickets')
            .setColor(0x5865F2)
            .setDescription('Klik op de knop hieronder om een privé supportkanaal te openen met ons moderatieteam.');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('📩 Open Ticket')
                .setStyle(ButtonStyle.Primary)
        );

        return message.channel.send({ embeds: [embed], components: [row] });
    }

    // Commando: !ownerlock (Eigenaar beveiliging)
    if (command === 'ownerlock') {
        if (message.author.id !== OWNER_ID) {
            return message.reply('⛔ **Toegang geweigerd!** Dit commando is uitsluitend voor de hoofdeigenaar van de bot.');
        }
        message.channel.send(`👑 **Owner-Lock Bevestigd:** Welkom baas! Jouw ID (\`${OWNER_ID}\`) heeft volledige immuniteit en controle over het systeem.`);
    }
});

// Interactie afhandeling voor het ticketsysteem knopje
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'create_ticket') {
        const guild = interaction.guild;
        const member = interaction.member;

        try {
            const ticketChannel = await guild.channels.create({
                name: `ticket-${member.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: member.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    },
                    {
                        id: client.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels],
                    },
                ],
            });

            await interaction.reply({ content: `✅ Je ticket is aangemaakt: ${ticketChannel}`, ephemeral: true });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`Ticket van ${member.user.tag}`)
                .setDescription('Welkom! Stel hier je vraag of leg je probleem uit. Een moderator helpt je zo snel mogelijk verder.')
                .setColor(0x38bdf8);

            await ticketChannel.send({ content: `${member}, hier is je ticket!`, embeds: [welcomeEmbed] });
        } catch (err) {
            console.error("Fout bij aanmaken ticket:", err);
            await interaction.reply({ content: '❌ Kon geen ticket kanaal aanmaken. Controleer de bot rechten.', ephemeral: true });
        }
    }
});

// Start de bot met de token uit Render environment variables
client.login(process.env.TOKEN);
