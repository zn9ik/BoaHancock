import { MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';
import { successEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { addAutoresponder } from '../../../services/autoresponderService.js';
import { takePendingAutoresponder } from '../../../services/autoresponderPending.js';

const HEX_COLOR_PATTERN = /^#?[0-9a-f]{6}$/i;

export default {
    name: 'autoresponder_add_modal',

    async execute(interaction, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) {
            logger.warn('Autoresponder add modal defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
            });
            return;
        }

        const pending = takePendingAutoresponder(`${interaction.user.id}:${interaction.guildId}`);
        if (!pending) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'This form expired. Run `/autoresponder add` again.',
            });
        }

        const response = interaction.fields.getTextInputValue('ar_response')?.trim() || null;
        const embedTitle = interaction.fields.getTextInputValue('ar_embed_title')?.trim() || null;
        const embedDescription = interaction.fields.getTextInputValue('ar_embed_description')?.trim() || null;
        const rawColor = interaction.fields.getTextInputValue('ar_embed_color')?.trim() || null;

        let color = null;
        if (rawColor) {
            if (!HEX_COLOR_PATTERN.test(rawColor)) {
                return replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'Embed color must be a hex code like #5865F2.',
                });
            }
            color = rawColor.startsWith('#') ? rawColor : `#${rawColor}`;
        }

        try {
            const record = await addAutoresponder(client, interaction.guildId, {
                trigger: pending.trigger,
                matchType: pending.matchType,
                response,
                embed: { title: embedTitle, description: embedDescription, color },
                image: pending.imageUrl,
                createdBy: interaction.user.id,
            });

            return InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        'Autoresponder Added',
                        `Trigger \`${record.trigger}\` (${record.matchType}) will now get a response.`,
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            return replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: error.message });
        }
    },
};
