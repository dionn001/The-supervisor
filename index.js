const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
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
const PREFIX = '!';

// Map om spam bij te houden per gebruiker
const spamTracker = new Map();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}! Bot is fully operational.`);
    client.user.setActivity('server protection & security', { type: 3 });
});

// Automatic security & command handler
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

    // 2. Automated Anti-Spam Protection
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        const userId = message.author.id;
        const currentTime = Date.now();
        
        if (!spamTracker.has(userId)) {
            spamTracker.set(userId, []);
        }

        const userTimestamps = spamTracker.get(userId);
        // Voeg huidige tijd toe en behoud alleen berichten van de laatste 4 seconden
        userTimestamps.push(currentTime);
        const recentMessages = userTimestamps.filter(timestamp => currentTime - timestamp < 4000);
        spamTracker.set(userId, recentMessages);

        // Als iemand 5 of meer berichten stuurt binnen 4 seconden -> spam gedetecteerd!
        if (recentMessages.length >= 5) {
            try {
                // Geef de gebruiker automatisch een time-out van 5 minuten (300000ms)
                await message.member.timeout(300000, 'Automatic Anti-Spam: Sending messages too fast.');
                
                const spamWarning = await message.channel.send(`🔇 **${message.author}** has been automatically timed out for 5 minutes due to spamming.`);
                setTimeout(() => spamWarning.delete().catch(() => {}), 6000);
                
                // Wis de tracker voor deze gebruiker
                spamTracker.delete(userId);
                return;
            } catch (err) {
                console.error("Failed to apply anti-spam timeout:", err);
            }
        }
    }

    // 3. Command Processing (starts with '!')
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Command: !help
    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ GuardBot Security & Commands')
            .setColor(0x38bdf8)
            .setDescription('Here is a complete list of all available commands:')
            .addFields(
                { name: '!ban <@user> [reason]', value: 'Permanently ban a user from the server.', inline: false },
                { name: '!kick <@user> [reason]', value: 'Kick a user out of the server.', inline: false },
                { name: '!mute <@user> [time]', value: 'Timeout a user (e.g., !mute @user 10m).', inline: false },
                { name: '!unmute <@user>', value: 'Remove a timeout from a user.', inline: false },
                { name: '!clear <1-100>', value: 'Clear a specified amount of messages.', inline: false },
                { name: '!lockdown', value: 'Instantly lock all text channels against raids.', inline: false },
                { name: '!unlock', value: 'Lift the channel lockdown.', inline: false },
                { name: '!slowmode <seconds>', value: 'Set a slowmode delay for the current channel.', inline: false },
                { name: '!addadmin <@role>', value: 'Assign a custom bot admin role or permission.', inline: false },
                { name: '!removeadmin <@role>', value: 'Remove a custom bot admin role.', inline: false },
                { name: '!poll <question>', value: 'Create an interactive voting poll.', inline: false },
                { name: '!serverinfo', value: 'Display detailed information about this server.', inline: false },
                { name: '!userinfo <@user>', value: 'Display information about a user.', inline: false },
                { name: '!ticket', value: 'Create a private support channel panel.', inline: false },
                { name: '!ownerlock', value: 'Exclusive security verification for the bot owner.', inline: false }
            )
            .setFooter({ text: 'GuardBot Server Protection' });

        return message.channel.send({ embeds: [embed] });
    }

    // Command: !ban
    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply('❌ You do not have permission to use this command (`Ban Members` required).');
        }
        const member = message.mentions.members.first();
        if (!member) return message.reply('⚠️ Please mention a valid user to ban (`!ban @user`).');
        
        const reason = args.slice(1).join(' ') || 'No reason provided';
        try {
            await member.ban({ reason: `Banned by ${message.author.tag} | Reason: ${reason}` });
            message.channel.send(`✅ **${member.user.tag}** has been successfully banned.`);
        } catch (err) {
            message.reply('❌ Failed to ban this user (missing permissions or higher role).');
        }
    }

    // Command: !kick
    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return message.reply('❌ You do not have permission to use this command (`Kick Members` required).');
        }
        const member = message.mentions.members.first();
        if (!member) return message.reply('⚠️ Please mention a valid user to kick (`!kick @user`).');
        
        const reason = args.slice(1).join(' ') || 'No reason provided';
        try {
            await member.kick(`Kicked by ${message.author.tag} | Reason: ${reason}`);
            message.channel.send(`✅ **${member.user.tag}** has been successfully kicked.`);
        } catch (err) {
            message.reply('❌ Failed to kick this user.');
        }
    }

    // Command: !mute (Timeout)
    if (command === 'mute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ You do not have permission to timeout members (`Moderate Members` required).');
        }
        const member = message.mentions.members.first();
        if (!member) return message.reply('⚠️ Please specify a user (`!mute @user 10m`).');

        const timeArg = args[1];
        if (!timeArg) return message.reply('⚠️ Please specify a duration (e.g., `10s`, `5m`, `1h`).');

        let durationMs = 0;
        const unit = timeArg.slice(-1);
        const value = parseInt(timeArg.slice(0, -1));

        if (isNaN(value)) return message.reply('⚠️ Invalid time format. Use numbers followed by s, m, or h.');

        if (unit === 's') durationMs = value * 1000;
        else if (unit === 'm') durationMs = value * 60 * 1000;
        else if (unit === 'h') durationMs = value * 60 * 60 * 1000;
        else return message.reply('⚠️ Use `s` for seconds, `m` for minutes, or `h` for hours.');

        try {
            await member.timeout(durationMs, `Timed out by ${message.author.tag}`);
            message.channel.send(`🔇 **${member.user.tag}** has been put in timeout for ${timeArg}.`);
        } catch (err) {
            message.reply('❌ Failed to timeout this user.');
        }
    }

    // Command: !unmute
    if (command === 'unmute') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply('❌ You lack permissions (`Moderate Members` required).');
        }
        const member = message.mentions.members.first();
        if (!member) return message.reply('⚠️ Please mention a user to unmute.');

        try {
            await member.timeout(null);
            message.channel.send(`🔊 Timeout has been removed for **${member.user.tag}**.`);
        } catch (err) {
            message.reply('❌ Failed to remove timeout.');
        }
    }

    // Command: !clear
    if (command === 'clear') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply('❌ You do not have permission to clear messages (`Manage Messages` required).');
        }
        const count = parseInt(args[0]);
        if (isNaN(count) || count < 1 || count > 100) {
            return message.reply('⚠️ Please specify a number between 1 and 100 (`!clear 50`).');
        }

        try {
            await message.channel.bulkDelete(count, true);
            const confirmation = await message.channel.send(`🧹 Successfully cleared **${count}** messages.`);
            setTimeout(() => confirmation.delete().catch(() => {}), 4000);
        } catch (err) {
            message.reply('❌ Messages older than 14 days cannot be bulk deleted.');
        }
    }

    // Command: !lockdown
    if (command === 'lockdown') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Only administrators can trigger a lockdown.');
        }

        try {
            await message.guild.channels.cache.forEach(async (channel) => {
                if (channel.type === ChannelType.GuildText) {
                    await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
                }
            });
            message.channel.send('🔒 **SERVER LOCKDOWN ACTIVATED!** All text channels have been locked down.');
        } catch (err) {
            message.reply('❌ An error occurred while activating lockdown.');
        }
    }

    // Command: !unlock
    if (command === 'unlock') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Only administrators can lift a lockdown.');
        }

        try {
            await message.guild.channels.cache.forEach(async (channel) => {
                if (channel.type === ChannelType.GuildText) {
                    await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
                }
            });
            message.channel.send('🔓 **SERVER UNLOCKED!** Text channels are open again.');
        } catch (err) {
            message.reply('❌ An error occurred while lifting lockdown.');
        }
    }

    // Command: !slowmode
    if (command === 'slowmode') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply('❌ You need `Manage Channels` permission.');
        }
        const seconds = parseInt(args[0]);
        if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
            return message.reply('⚠️ Please specify seconds between 0 and 21600 (`!slowmode 5`).');
        }

        try {
            await message.channel.setRateLimitPerUser(seconds);
            if (seconds === 0) {
                message.channel.send('⏱️ Slowmode has been disabled.');
            } else {
                message.channel.send(`⏱️ Slowmode set to **${seconds}** seconds.`);
            }
        } catch (err) {
            message.reply('❌ Failed to update slowmode.');
        }
    }

    // Command: !addadmin
    if (command === 'addadmin') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Only server administrators can assign bot management roles.');
        }
        const role = message.mentions.roles.first();
        if (!role) return message.reply('⚠️ Please mention a role to grant admin status (`!addadmin @RoleName`).');

        try {
            await role.setPermissions([PermissionsBitField.Flags.Administrator], `Granted bot admin by ${message.author.tag}`);
            message.channel.send(`✅ Role **${role.name}** has been successfully granted full Administrator privileges.`);
        } catch (err) {
            message.reply('❌ Failed to update role permissions. Make sure my bot role is higher than the target role in the server settings.');
        }
    }

    // Command: !removeadmin
    if (command === 'removeadmin') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Only server administrators can remove bot management roles.');
        }
        const role = message.mentions.roles.first();
        if (!role) return message.reply('⚠️ Please mention a role to remove admin status (`!removeadmin @RoleName`).');

        try {
            await role.setPermissions([], `Removed bot admin by ${message.author.tag}`);
            message.channel.send(`✅ Administrator privileges have been removed from **${role.name}**.`);
        } catch (err) {
            message.reply('❌ Failed to update role permissions. Check my role hierarchy.');
        }
    }

    // Command: !poll
    if (command === 'poll') {
        const question = args.join(' ');
        if (!question) return message.reply('⚠️ Please provide a poll question (`!poll Should we add new events?`).');

        const embed = new EmbedBuilder()
            .setTitle('📊 Server Poll')
            .setDescription(question)
            .setColor(0x5865F2)
            .setFooter({ text: `Poll created by ${message.author.tag}` });

        const pollMsg = await message.channel.send({ embeds: [embed] });
        await pollMsg.react('👍');
        await pollMsg.react('👎');
        await message.delete().catch(() => {});
    }

    // Command: !serverinfo
    if (command === 'serverinfo') {
        const guild = message.guild;
        const embed = new EmbedBuilder()
            .setTitle(`Server Info: ${guild.name}`)
            .setColor(0x38bdf8)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: 'Owner ID', value: `${guild.ownerId}`, inline: true },
                { name: 'Total Members', value: `${guild.memberCount}`, inline: true },
                { name: 'Created On', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
            );
        return message.channel.send({ embeds: [embed] });
    }

    // Command: !userinfo
    if (command === 'userinfo') {
        const target = message.mentions.members.first() || message.member;
        const embed = new EmbedBuilder()
            .setTitle(`User Info: ${target.user.tag}`)
            .setColor(0x38bdf8)
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'User ID', value: `${target.id}`, inline: true },
                { name: 'Joined Server', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: 'Account Created', value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>`, inline: true }
            );
        return message.channel.send({ embeds: [embed] });
    }

    // Command: !ticket
    if (command === 'ticket') {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Support Ticket System')
            .setColor(0x5865F2)
            .setDescription('Click the button below to open a private support ticket with the staff team.');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel('📩 Open Ticket')
                .setStyle(ButtonStyle.Primary)
        );

        return message.channel.send({ embeds: [embed], components: [row] });
    }

    // Command: !ownerlock
    if (command === 'ownerlock') {
        if (message.author.id !== OWNER_ID) {
            return message.reply('⛔ **Access Denied!** This command is strictly restricted to the primary owner.');
        }
        message.channel.send(`👑 **Owner-Lock Confirmed:** Welcome boss! Your ID (\`${OWNER_ID}\`) holds supreme immunity and system control.`);
    }
});

// Ticket button creation interaction handler
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

            await interaction.reply({ content: `✅ Your ticket has been created: ${ticketChannel}`, ephemeral: true });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`Ticket for ${member.user.tag}`)
                .setDescription('Welcome! Describe your issue or question below. A staff member will assist you shortly.')
                .setColor(0x38bdf8);

            await ticketChannel.send({ content: `${member}, here is your ticket!`, embeds: [welcomeEmbed] });
        } catch (err) {
            console.error("Error creating ticket channel:", err);
            await interaction.reply({ content: '❌ Could not create ticket channel. Please check bot permissions.', ephemeral: true });
        }
    }
});

// Start bot using token from Render environment variables
client.login(process.env.TOKEN);
