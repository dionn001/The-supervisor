const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, SlashCommandBuilder, REST, Routes } = require('discord.js');
const express = require('express');

// Express server to keep the bot alive on Render
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
const spamTracker = new Map();

// Define all Slash Commands
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('Shows all available security and moderation commands.'),
    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Permanently ban a user from the server.')
        .addUserOption(option => option.setName('user').setDescription('The user to ban').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for the ban').setRequired(false)),
    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user out of the server.')
        .addUserOption(option => option.setName('user').setDescription('The user to kick').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for the kick').setRequired(false)),
    new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Timeout a user.')
        .addUserOption(option => option.setName('user').setDescription('The user to timeout').setRequired(true))
        .addStringOption(option => option.setName('time').setDescription('Duration (e.g., 10s, 5m, 1h)').setRequired(true)),
    new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Remove a timeout from a user.')
        .addUserOption(option => option.setName('user').setDescription('The user to unmute').setRequired(true)),
    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear messages (1-100).')
        .addIntegerOption(option => option.setName('count').setDescription('Number of messages to clear').setRequired(true)),
    new SlashCommandBuilder().setName('lockdown').setDescription('Lock all text channels against raids.'),
    new SlashCommandBuilder().setName('unlock').setDescription('Lift the channel lockdown.'),
    new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set slowmode delay in seconds.')
        .addIntegerOption(option => option.setName('seconds').setDescription('Seconds (0 to disable)').setRequired(true)),
    new SlashCommandBuilder()
        .setName('addadmin')
        .setDescription('Grant Administrator privileges to a role.')
        .addRoleOption(option => option.setName('role').setDescription('The role to grant admin').setRequired(true)),
    new SlashCommandBuilder()
        .setName('removeadmin')
        .setDescription('Remove Administrator privileges from a role.')
        .addRoleOption(option => option.setName('role').setDescription('The role to remove admin').setRequired(true)),
    new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create an interactive voting poll.')
        .addStringOption(option => option.setName('question').setDescription('The poll question').setRequired(true)),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Display detailed server information.'),
    new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Display information about a user.')
        .addUserOption(option => option.setName('user').setDescription('The user to inspect').setRequired(false)),
    new SlashCommandBuilder().setName('ticket').setDescription('Create a support ticket panel.'),
    new SlashCommandBuilder().setName('ownerlock').setDescription('Exclusive security check for the bot owner.')
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}! Bot is fully operational.`);
    client.user.setActivity('server protection & security', { type: 3 });

    // Automatically register Slash Commands across all servers
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// Automatic Security (Anti-Link & Anti-Spam)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // 1. Anti-Link Protection
    if (message.content.includes('http://') || message.content.includes('https://') || message.content.includes('www.')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            try {
                await message.delete();
                const warning = await message.channel.send(`⚠️ ${message.author}, sending links is not allowed in this server!`);
                setTimeout(() => warning.delete().catch(() => {}), 5000);
                return;
            } catch (err) {
                console.error("Failed to delete message:", err);
            }
        }
    }

    // 2. Anti-Spam Protection
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        const userId = message.author.id;
        const currentTime = Date.now();
        
        if (!spamTracker.has(userId)) {
            spamTracker.set(userId, []);
        }

        const userTimestamps = spamTracker.get(userId);
        userTimestamps.push(currentTime);
        const recentMessages = userTimestamps.filter(timestamp => currentTime - timestamp < 4000);
        spamTracker.set(userId, recentMessages);

        if (recentMessages.length >= 5) {
            try {
                await message.member.timeout(300000, 'Automatic Anti-Spam: Sending messages too fast.');
                const spamWarning = await message.channel.send(`🔇 **${message.author}** has been automatically timed out for spamming.`);
                setTimeout(() => spamWarning.delete().catch(() => {}), 6000);
                spamTracker.delete(userId);
                return;
            } catch (err) {
                console.error("Failed to apply anti-spam timeout:", err);
            }
        }
    }
});

// Slash Command Handler & Ticket Buttons
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, options, member, guild } = interaction;

        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ GuardBot Security & Slash Commands')
                .setColor(0x38bdf8)
                .setDescription('Type `/` in chat to see all available commands:')
                .addFields(
                    { name: 'Moderation', value: '`/ban`, `/kick`, `/mute`, `/unmute`, `/clear`', inline: false },
                    { name: 'Security', value: '`/lockdown`, `/unlock`, `/slowmode`, `/addadmin`, `/removeadmin`', inline: false },
                    { name: 'Utilities', value: '`/ticket`, `/poll`, `/serverinfo`, `/userinfo`, `/ownerlock`', inline: false }
                )
                .setFooter({ text: 'GuardBot Server Protection' });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'ban') {
            if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return interaction.reply({ content: '❌ You do not have permission (`Ban Members` required).', ephemeral: true });
            }
            const target = options.getMember('user');
            const reason = options.getString('reason') || 'No reason provided';
            try {
                await target.ban({ reason });
                await interaction.reply({ content: `✅ **${target.user.tag}** has been successfully banned.` });
            } catch (err) {
                interaction.reply({ content: '❌ Failed to ban this user.', ephemeral: true });
            }
        }

        if (commandName === 'kick') {
            if (!member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                return interaction.reply({ content: '❌ You do not have permission (`Kick Members` required).', ephemeral: true });
            }
            const target = options.getMember('user');
            const reason = options.getString('reason') || 'No reason provided';
            try {
                await target.kick(reason);
                await interaction.reply({ content: `✅ **${target.user.tag}** has been kicked.` });
            } catch (err) {
                interaction.reply({ content: '❌ Failed to kick this user.', ephemeral: true });
            }
        }

        if (commandName === 'mute') {
            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                return interaction.reply({ content: '❌ You do not have permission (`Moderate Members` required).', ephemeral: true });
            }
            const target = options.getMember('user');
            const timeArg = options.getString('time');
            let durationMs = 0;
            const unit = timeArg.slice(-1);
            const value = parseInt(timeArg.slice(0, -1));

            if (unit === 's') durationMs = value * 1000;
            else if (unit === 'm') durationMs = value * 60 * 1000;
            else if (unit === 'h') durationMs = value * 60 * 60 * 1000;

            try {
                await target.timeout(durationMs);
                await interaction.reply({ content: `🔇 **${target.user.tag}** has been muted for ${timeArg}.` });
            } catch (err) {
                interaction.reply({ content: '❌ Failed to apply timeout.', ephemeral: true });
            }
        }

        if (commandName === 'unmute') {
            if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
            }
            const target = options.getMember('user');
            try {
                await target.timeout(null);
                await interaction.reply({ content: `🔊 Timeout removed for **${target.user.tag}**.` });
            } catch (err) {
                interaction.reply({ content: '❌ Failed to remove timeout.', ephemeral: true });
            }
        }

        if (commandName === 'clear') {
            if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                return interaction.reply({ content: '❌ You do not have permission (`Manage Messages` required).', ephemeral: true });
            }
            const count = options.getInteger('count');
            try {
                await interaction.channel.bulkDelete(count, true);
                await interaction.reply({ content: `🧹 Successfully cleared **${count}** messages.`, ephemeral: true });
            } catch (err) {
                interaction.reply({ content: '❌ Cannot delete messages older than 14 days.', ephemeral: true });
            }
        }

        if (commandName === 'lockdown') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Administrators only.', ephemeral: true });
            }
            await guild.channels.cache.forEach(async (channel) => {
                if (channel.type === ChannelType.GuildText) {
                    await channel.permissionOverwrites.edit(guild.id, { SendMessages: false });
                }
            });
            await interaction.reply({ content: '🔒 **SERVER LOCKDOWN ACTIVATED!**' });
        }

        if (commandName === 'unlock') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Administrators only.', ephemeral: true });
            }
            await guild.channels.cache.forEach(async (channel) => {
                if (channel.type === ChannelType.GuildText) {
                    await channel.permissionOverwrites.edit(guild.id, { SendMessages: null });
                }
            });
            await interaction.reply({ content: '🔓 **SERVER UNLOCKED!**' });
        }

        if (commandName === 'slowmode') {
            if (!member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return interaction.reply({ content: '❌ You need `Manage Channels` permission.', ephemeral: true });
            }
            const seconds = options.getInteger('seconds');
            await interaction.channel.setRateLimitPerUser(seconds);
            await interaction.reply({ content: `⏱️ Slowmode set to **${seconds}** seconds.` });
        }

        if (commandName === 'addadmin') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Administrators only.', ephemeral: true });
            }
            const role = options.getRole('role');
            await role.setPermissions([PermissionsBitField.Flags.Administrator]);
            await interaction.reply({ content: `✅ Role **${role.name}** has been granted Administrator permissions.` });
        }

        if (commandName === 'removeadmin') {
            if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Administrators only.', ephemeral: true });
            }
            const role = options.getRole('role');
            await role.setPermissions([]);
            await interaction.reply({ content: `✅ Administrator permissions removed from **${role.name}**.` });
        }

        if (commandName === 'poll') {
            const question = options.getString('question');
            const embed = new EmbedBuilder()
                .setTitle('📊 Server Poll')
                .setDescription(question)
                .setColor(0x5865F2)
                .setFooter({ text: `Poll created by ${member.user.tag}` });

            const pollMsg = await interaction.channel.send({ embeds: [embed] });
            await pollMsg.react('👍');
            await pollMsg.react('👎');
            await interaction.reply({ content: '✅ Poll created!', ephemeral: true });
        }

        if (commandName === 'serverinfo') {
            const embed = new EmbedBuilder()
                .setTitle(`Server Info: ${guild.name}`)
                .setColor(0x38bdf8)
                .addFields(
                    { name: 'Members', value: `${guild.memberCount}`, inline: true },
                    { name: 'Owner ID', value: `${guild.ownerId}`, inline: true }
                );
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'userinfo') {
            const target = options.getMember('user') || member;
            const embed = new EmbedBuilder()
                .setTitle(`User Info: ${target.user.tag}`)
                .setColor(0x38bdf8)
                .addFields({ name: 'User ID', value: `${target.id}`, inline: true });
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'ticket') {
            const embed = new EmbedBuilder()
                .setTitle('🎫 Support Ticket System')
                .setColor(0x5865F2)
                .setDescription('Click the button below to open a private support ticket channel.');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('📩 Open Ticket')
                    .setStyle(ButtonStyle.Primary)
            );

            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'ownerlock') {
            if (interaction.user.id !== OWNER_ID) {
                return interaction.reply({ content: '⛔ **Access Denied!** Restricted to primary owner.', ephemeral: true });
            }
            return interaction.reply({ content: `👑 **Owner-Lock Confirmed:** Welcome boss! (\`${OWNER_ID}\`)`, ephemeral: true });
        }
    }

    // Button interactions (Opening & Closing Tickets)
    if (interaction.isButton()) {
        const { customId, guild, member } = interaction;

        if (customId === 'create_ticket') {
            try {
                const ticketChannel = await guild.channels.create({
                    name: `ticket-${member.user.username}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] },
                    ],
                });

                await interaction.reply({ content: `✅ Your ticket has been created: ${ticketChannel}`, ephemeral: true });

                const welcomeEmbed = new EmbedBuilder()
                    .setTitle(`Ticket for ${member.user.tag}`)
                    .setDescription('Welcome! Describe your issue below. Click the button below to close this ticket when resolved.')
                    .setColor(0x38bdf8);

                // Close ticket button
                const closeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('🔒 Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                );

                await ticketChannel.send({ content: `${member}`, embeds: [welcomeEmbed], components: [closeRow] });
            } catch (err) {
                console.error("Error creating ticket:", err);
                await interaction.reply({ content: '❌ Could not create ticket channel.', ephemeral: true });
            }
        }

        if (customId === 'close_ticket') {
            await interaction.reply({ content: '🔒 This ticket will be closed and deleted in 5 seconds...' });
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (err) {
                    console.error("Could not delete channel:", err);
                }
            }, 5000);
        }
    }
});

client.login(process.env.TOKEN);
