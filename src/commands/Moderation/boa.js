import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} from 'discord.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { pendingBoaMessages } from '../../services/boaPending.js';

const TEXT_CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

export default {
    data: new SlashCommandBuilder()
        .setName('boa')
        .setDescription('Open a rich message editor to post as the bot (multi-line, supports server emojis)')
        .addChannelOption((opt) =>
            opt
                .setName('channel')
                .setDescription('Channel to send in (defaults to the current channel)')
                .addChannelTypes(...TEXT_CHANNEL_TYPES)
                .setRequired(false),
        )
        .addAttachmentOption((opt) =>
            opt.setName('attachment').setDescription('An image or file to include').setRequired(false),
        )
        .addUserOption((opt) =>
            opt.setName('mention_user').setDescription('A user to mention — use {user} in your text').setRequired(false),
        )
        .addUserOption((opt) =>
            opt.setName('mention_user2').setDescription('A second user to mention — use {user2} in your text').setRequired(false),
        )
        .addRoleOption((opt) =>
            opt.setName('mention_role').setDescription('A role to mention — use {role} in your text').setRequired(false),
        )
        .addStringOption((opt) =>
            opt
                .setName('ping')
                .setDescription('Ping everyone/here — use {ping} in your text')
                .setRequired(false)
                .addChoices(
                    { name: '@everyone', value: 'everyone' },
                    { name: '@here', value: 'here' },
                ),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),
    category: 'moderation',

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const attachment = interaction.options.getAttachment('attachment');

        const memberPermissions = channel.permissionsFor(interaction.member);
        const botPermissions = channel.permissionsFor(interaction.guild.members.me);

        if (!memberPermissions?.has(PermissionFlagsBits.SendMessages)) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: `You do not have permission to send messages in ${channel}.`,
            });
        }

        if (!botPermissions?.has(PermissionFlagsBits.SendMessages)) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: `I do not have permission to send messages in ${channel}.`,
            });
        }

        const mentionUser = interaction.options.getUser('mention_user');
        const mentionUser2 = interaction.options.getUser('mention_user2');
        const mentionRole = interaction.options.getRole('mention_role');
        const ping = interaction.options.getString('ping');

        pendingBoaMessages.set(`${interaction.user.id}:${interaction.guildId}`, {
            channelId: channel.id,
            attachmentUrl: attachment?.url || null,
            mentionUserId: mentionUser?.id || null,
            mentionUser2Id: mentionUser2?.id || null,
            mentionRoleId: mentionRole?.id || null,
            ping: ping || null,
            expiresAt: Date.now() + 5 * 60 * 1000,
        });

        const messageInput = new TextInputBuilder()
            .setCustomId('boa_message')
            .setLabel('Message')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Type freely. Use :emojiname:, {user}, {user2}, {role}, {ping} as needed.')
            .setMaxLength(4000)
            .setRequired(true);

        const modal = new ModalBuilder()
            .setCustomId('boa_modal')
            .setTitle('Compose message')
            .addComponents(new ActionRowBuilder().addComponents(messageInput));

        await interaction.showModal(modal);
    },
};
