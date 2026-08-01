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

        pendingBoaMessages.set(`${interaction.user.id}:${interaction.guildId}`, {
            channelId: channel.id,
            attachmentUrl: attachment?.url || null,
            expiresAt: Date.now() + 5 * 60 * 1000,
        });

        const messageInput = new TextInputBuilder()
            .setCustomId('boa_message')
            .setLabel('Message')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Type freely. Use :emojiname: for emojis, <@id> for users, <@&id> for roles.')
            .setMaxLength(4000)
            .setRequired(true);

        const modal = new ModalBuilder()
            .setCustomId('boa_modal')
            .setTitle('Compose message')
            .addComponents(new ActionRowBuilder().addComponents(messageInput));

        await interaction.showModal(modal);
    },
};
