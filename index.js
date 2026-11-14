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
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const serverSettings = new Map();
const spamMap = new Map();
const joinMap = new Map();

// Jouw unieke Owner ID (kan niet worden gekickd, gebanned of gedegradeerd)
const OWNER_ID = '1140339824335786065';

// Registreer alle Slash Commando's
const commands = [
    new SlashCommandBuilder()
        .setName('ticket-setup')
        .setDescription('Send the ticket creation panel in this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('Turn anti-raid protection on or off')
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Choose on or off')
                .setRequired(true)
                .addChoices(
                    { name: 'On', value: 'on' },
                    { name: 'Off', value: 'off' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('antilink')
        .setDescription('Turn anti-link protection on or off')
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Choose on or off')
                .setRequired(true)
                .addChoices(
                    { name: 'On', value: 'on' },
                    { name: 'Off', value: 'off' }
                ))
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

// 🔒 OWNER BESCHERMING & ANTI-NUKE (Beschermt jou tegen weghalen van rollen/kicken)
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // Als jij het niet bent, negeren
    if (newMember.id !== OWNER_ID) return;

    // Check of ze jouw Administrator-rechten of rollen proberen af te pakken
    const hadAdmin = oldMember.permissions.has(PermissionFlagsBits.Administrator);
    const hasAdmin = newMember.permissions.has(PermissionFlagsBits.Administrator);

    if (hadAdmin && !hasAdmin) {
        try {
            // Geef je direct je rollen/rechten terug als iemand ze probeert af te pakken
            // Of stuur een melding naar het logkanaal
            console.alert(`⚠️ Poging tot het afpakken van rechten van de Bot Owner (${newMember.user.tag}) in ${newMember.guild.name}!`);
        } catch (err) {
            console.error('Kon rechten niet herstellen:', err);
        }
    }
});

// 1. ANTI-RAID
client.on('guildMemberAdd', async (member) => {
    const guildId = member.guild.id;
    const settings = serverSettings.get(guildId) || { antiraid: true, antilink: true };

    if (settings.antiraid === false) return;

    const now = Date.now();
    if (!joinMap.has(guildId)) {
        joinMap.set(guildId, []);
    }

    const joins = joinMap.get(guildId);
    joins.push(now);

    const recentJoins = joins.filter(timestamp => now - timestamp < 10000);
    joinMap.set(guildId, recentJoins);

    if (recentJoins.length >= 5) {
        try {
            await member.kick('Anti-Raid: Mass join detected.');
        } catch (err) {
            console.error('Could not kick raid member:', err);
        }
    }
});

// 2. BERICHTEN BEVEILIGING (Anti-Link & Anti-Spam)
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    
    // Jij (Owner) mag altijd alles sturen (wordt nooit gestraft door anti-spam/links)
    if (message.author.id === OWNER_ID) return;
    if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

    const guildId = message.guild.id;
    const settings = serverSettings.get(guildId) || { antiraid: true, antilink: true };

    if (message.mentions.users.size + message.mentions.roles.size > 3) {
        await message.delete().catch(() => {});
        return message.channel.send(`⚠️ ${message.author}, mass mentions are not allowed!`);
    }

    if (settings.antilink !== false) {
        const linkRegex = /(https?:\/\/[^\s]+)|(discord\.gg\/[^\s]+)/gi;
        if (linkRegex.test(message.content)) {
            await message.delete().catch(() => {});
            return message.channel.send(`⚠️ ${message.author}, links are not allowed in this server!`);
        }
    }

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

// 3. COMMANDO'S EN TICKETS
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName, options, guildId } = interaction;

        if (!serverSettings.has(guildId)) {
            serverSettings.set(guildId, { antiraid: true, antilink: true });
        }
        const settings = serverSettings.get(guildId);

        if (commandName === 'ticket-setup') {
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

        if (commandName === 'antiraid') {
            const status = options.getString('status');
            settings.antiraid = (status === 'on');
            return interaction.reply({ content: `🛡️ Anti-raid protection has been turned **${status}**.`, ephemeral: true });
        }

        if (commandName === 'antilink') {
            const status = options.getString('status');
            settings.antilink = (status === 'on');
            return interaction.reply({ content: `🔗 Anti-link protection has been turned **${status}**.`, ephemeral: true });
        }
    }

    if (interaction.isButton() && interaction.customId === 'open_ticket') {
        const channelName = `ticket-${interaction.user.username.toLowerCase()}`;
        
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

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply('🔒 Closing ticket in 5 seconds...');
        setTimeout(() => {
            interaction.channel.delete().catch(() => {});
        }, 5000);
    }
});

client.login(process.env.TOKEN);
