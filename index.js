const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(process.env.PORT || 3000);

const { 
    Client, GatewayIntentBits, PermissionFlagsBits, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ChannelType, REST, Routes, SlashCommandBuilder 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const spamMap = new Map();

// Registreer het Engelse /ticket-setup commando
const commands = [
    new SlashCommandBuilder()
        .setName('ticket-setup')
        .setDescription('Send the ticket creation panel in this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Slash commands registered globally.');
    } catch (error) {
        console.error(error);
    }
});

// 1. ANTI-LINK & ANTI-SPAM (Engels)
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

    // Anti-Link
    const linkRegex = /(https?:\/\/[^\s]+)|(discord\.gg\/[^\s]+)/gi;
    if (linkRegex.test(message.content)) {
        await message.delete().catch(() => {});
        return message.channel.send(`⚠️ ${message.author}, links are not allowed in this server!`);
    }

    // Anti-Spam (5 berichten binnen 5 seconden)
    const userId = message.author.id;
    const now = Date.now();
    
    if (!spamMap.has(userId)) {
        spamMap.set(userId, { count: 1, lastMessage: now });
    } else {
        const userData = spamMap.get(userId);
        if (now - userData.lastMessage < 5000) {
            userData.count++;
            if (userData.count >= 5) {
                await message.member.timeout(60 * 1000, 'Spamming').catch(() => {});
                message.channel.send(`🔇 ${message.author} has been timed out for 1 minute due to spamming.`);
                spamMap.delete(userId);
            }
        } else {
            userData.count = 1;
            userData.lastMessage = now;
        }
    }
});

// 2. TICKET SYSTEEM (Engels)
client.on('interactionCreate', async (interaction) => {
    // Commando: /ticket-setup
    if (interaction.isChatInputCommand() && interaction.commandName === 'ticket-setup') {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Support Tickets')
            .setDescription('Need help? Click the button below to open a private ticket with our staff team.')
            .setColor('#5865F2');

        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_ticket')
                .setLabel('Open Ticket')
                .setEmoji('📩')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.channel.send({ embeds: [embed], components: [button] });
        return interaction.reply({ content: '✅ Ticket panel created!', ephemeral: true });
    }

    // Knop: Open Ticket
    if (interaction.isButton() && interaction.customId === 'open_ticket') {
        const channelName = `ticket-${interaction.user.username.toLowerCase()}`;
        
        // Check of gebruiker al een open ticket heeft
        const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);
        if (existingChannel) {
            return interaction.reply({ content: `❌ You already have an open ticket: ${existingChannel}`, ephemeral: true });
        }

        const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const closeButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('Close Ticket')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({
            content: `Welcome ${interaction.user}! Staff will be with you shortly.`,
            components: [closeButton]
        });

        return interaction.reply({ content: `✅ Your ticket has been created: ${ticketChannel}`, ephemeral: true });
    }

    // Knop: Close Ticket
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply('🔒 Closing ticket in 5 seconds...');
        setTimeout(() => {
            interaction.channel.delete().catch(() => {});
        }, 5000);
    }
});

client.login(process.env.TOKEN);
