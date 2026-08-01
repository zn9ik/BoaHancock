import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

const TEXT_CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

export default {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Makes the bot say something.')
        .addStringOption((opt) =>
            opt.setName('content').setDescription('What the bot should say').setRequired(false).setMaxLength(2000),
        )
        .addAttachmentOption((opt) =>
            opt.setName('attachment').setDescription('An image or file to include').setRequired(false),
        )
        .addChannelOption((opt) =>
            opt
                .setName('channel')
                .setDescription('Channel to send in (defaults to the current channel)')
                .addChannelTypes(...TEXT_CHANNEL_TYPES)
                .setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),
    category: 'moderation',

    async execute(interaction) {
        const content = interaction.options.getString('content');
        const attachment = interaction.options.getAttachment('attachment');
        const channel = interaction.options.getChannel('channel') || interaction.channel;

        if (!content && !attachment) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Provide a message, an attachment, or both.',
            });
        }

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

        await channel.send({
            content: content || undefined,
            files: attachment ? [attachment.url] : undefined,
        });

        await interaction.reply({ content: `Message sent in ${channel}.`, flags: MessageFlags.Ephemeral });
    },
};
