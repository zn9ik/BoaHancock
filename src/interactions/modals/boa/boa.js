import { MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import { takePendingBoaMessage } from '../../../services/boaPending.js';
import { resolveGuildEmojis } from '../../../utils/resolveGuildEmojis.js';

// Preserves newlines/tabs (so multi-line messages survive) while stripping
// other non-printable control characters.
function sanitizeMessageContent(input, maxLength = 4000) {
    if (typeof input !== 'string') return '';

    return input
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .trim()
        .slice(0, maxLength);
}

export default {
    name: 'boa_modal',

    async execute(interaction, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) {
            logger.warn('Boa modal defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
            });
            return;
        }

        const pending = takePendingBoaMessage(`${interaction.user.id}:${interaction.guildId}`);
        if (!pending) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'This form expired. Run `/boa` again.',
            });
        }

        const rawMessage = interaction.fields.getTextInputValue('boa_message');
        const cleaned = sanitizeMessageContent(rawMessage, 4000);

        if (!cleaned) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Message cannot be empty.',
            });
        }

        const content = resolveGuildEmojis(cleaned, interaction.guild);

        const channel = interaction.guild.channels.cache.get(pending.channelId)
            ?? await interaction.guild.channels.fetch(pending.channelId).catch(() => null);

        if (!channel || !channel.isTextBased()) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'That channel is no longer available.',
            });
        }

        const botPermissions = channel.permissionsFor(interaction.guild.members.me);
        if (!botPermissions?.has('SendMessages')) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: `I no longer have permission to send messages in ${channel}.`,
            });
        }

        const sentMessage = await channel.send({
            content,
            files: pending.attachmentUrl ? [pending.attachmentUrl] : undefined,
            allowedMentions: { parse: ['users', 'roles', 'everyone'] },
        });

        await InteractionHelper.safeEditReply(interaction, {
            content: `Message sent in ${channel}. [Jump to message](${sentMessage.url})`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
