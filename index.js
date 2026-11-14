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

// Jouw unieke Owner ID
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
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Delete a specific amount of messages (1-100)')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('View information about this server'),

    new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('View information about this bot')
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ All advanced slash commands registered globally.');
    } catch (error) {
        console.error(error);
    }
});

// Anti-Raid bij joinen
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

// Berichten beveiliging (Anti-Link & Anti-Spam)
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
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

// Afhandelen van alle commando's en knoppen
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

        if (commandName === 'clear') {
            const amount = options.getInteger('amount');
            await interaction.channel.bulkDelete(amount, true).catch(() => {});
            return interaction.reply({ content: `🧹 Successfully deleted **${amount}** messages.`, ephemeral: true });
        }

        if (commandName === 'ban') {
            const target = options.getUser('target');
            const reason = options.getString('reason') || 'No reason provided';
            const member = await interaction.guild.members.fetch(target.id).catch(() => {});
            
            if (!member) return interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });

            await member.ban({ reason }).catch(() => {});
            return interaction.reply({ content: `🔨 Banned **${target.tag}** for: *${reason}*` });
        }

        if (commandName === 'kick') {
            const target = options.getUser('target');
            const reason = options.getString('reason') || 'No reason provided';
            const member = await interaction.guild.members.fetch(target.id).catch(() => {});
            
            if (!member) return interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });

            await member.kick(reason).catch(() => {});
            return interaction.reply({ content: `👢 Kicked **${target.tag}** for: *${reason}*` });
        }

        if (commandName === 'serverinfo') {
            const embed = new EmbedBuilder()
                .setTitle(`📊 Server Info: ${interaction.guild.name}`)
                .addFields(
                    { name: 'Total Members', value: `${interaction.guild.memberCount}`, inline: true },
                    { name: 'Created On', value: `${interaction.guild.createdAt.toDateString()}`, inline: true }
                )
                .setColor('#38bdf8');
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'botinfo') {
            const embed = new EmbedBuilder()
                .setTitle('🤖 Bot Information')
                .setDescription('A secure, cloud-hosted moderation and ticket bot.')
                .addFields(
                    { name: 'Developer / Owner ID', value: `${OWNER_ID}`, inline: true },
                    { name: 'Status', value: 'Online 24/7 in the cloud', inline: true }
                )
                .setColor('#5865F2');
            return interaction.reply({ embeds: [embed] });
        }
    }

    // Tickets knoppen
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
