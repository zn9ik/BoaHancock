import {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
} from 'discord.js';
import { getColor, isBotOwner } from '../../config/bot.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { successEmbed } from '../../utils/embeds.js';
import { getAutoresponders, removeAutoresponder } from '../../services/autoresponderService.js';
import { pendingAutoresponders } from '../../services/autoresponderPending.js';

function hasAutoresponderAccess(interaction) {
    return isBotOwner(interaction.user.id) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function accessDenied(interaction) {
    return replyUserError(interaction, {
        type: ErrorTypes.PERMISSION,
        message: 'You need Administrator permission (or be the bot owner) to manage autoresponders.',
    });
}

export default {
    data: new SlashCommandBuilder()
        .setName('autoresponder')
        .setDescription('Manage keyword-triggered auto-responses for this server')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((sub) =>
            sub
                .setName('add')
                .setDescription('Add a new autoresponder (opens a form for the message)')
                .addStringOption((opt) =>
                    opt.setName('trigger').setDescription('The word/phrase that triggers a response').setRequired(true).setMaxLength(200),
                )
                .addStringOption((opt) =>
                    opt
                        .setName('match_type')
                        .setDescription('How the trigger should be matched')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Exact match (message must equal the trigger)', value: 'exact' },
                            { name: 'Contains (trigger can appear anywhere in the message)', value: 'contains' },
                        ),
                )
                .addAttachmentOption((opt) =>
                    opt.setName('image').setDescription('Optional image to include in the response').setRequired(false),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('remove')
                .setDescription('Remove an autoresponder by its exact trigger text')
                .addStringOption((opt) =>
                    opt.setName('trigger').setDescription('The exact trigger text to remove').setRequired(true).setMaxLength(200),
                ),
        )
        .addSubcommand((sub) => sub.setName('list').setDescription('List all autoresponders configured in this server')),

    category: 'community',

    async execute(interaction, _config, client) {
        if (!hasAutoresponderAccess(interaction)) {
            return accessDenied(interaction);
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'add') {
            const trigger = interaction.options.getString('trigger');
            const matchType = interaction.options.getString('match_type');
            const image = interaction.options.getAttachment('image');

            pendingAutoresponders.set(`${interaction.user.id}:${interaction.guildId}`, {
                trigger,
                matchType,
                imageUrl: image?.url || null,
                expiresAt: Date.now() + 5 * 60 * 1000,
            });

            const responseInput = new TextInputBuilder()
                .setCustomId('ar_response')
                .setLabel('Text response (leave blank if embed-only)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(2000);

            const embedTitleInput = new TextInputBuilder()
                .setCustomId('ar_embed_title')
                .setLabel('Embed title (optional)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(256);

            const embedDescInput = new TextInputBuilder()
                .setCustomId('ar_embed_description')
                .setLabel('Embed description (optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(4000);

            const embedColorInput = new TextInputBuilder()
                .setCustomId('ar_embed_color')
                .setLabel('Embed color hex, e.g. #5865F2 (optional)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(7);

            const modal = new ModalBuilder()
                .setCustomId('autoresponder_add_modal')
                .setTitle(`Autoresponder: ${trigger}`.slice(0, 45))
                .addComponents(
                    new ActionRowBuilder().addComponents(responseInput),
                    new ActionRowBuilder().addComponents(embedTitleInput),
                    new ActionRowBuilder().addComponents(embedDescInput),
                    new ActionRowBuilder().addComponents(embedColorInput),
                );

            return interaction.showModal(modal);
        }

        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) {
            logger.warn('Autoresponder interaction defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                subcommand,
            });
            return;
        }

        if (subcommand === 'remove') {
            const trigger = interaction.options.getString('trigger');
            try {
                const removed = await removeAutoresponder(client, interaction.guildId, trigger);
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed('Autoresponder Removed', `Removed the trigger "${removed.trigger}".`)],
                    flags: MessageFlags.Ephemeral,
                });
            } catch (error) {
                return replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: error.message });
            }
        }

        if (subcommand === 'list') {
            const list = await getAutoresponders(client, interaction.guildId);

            if (list.length === 0) {
                return InteractionHelper.safeEditReply(interaction, {
                    content: 'No autoresponders are configured in this server yet. Use `/autoresponder add` to create one.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const embed = new EmbedBuilder()
                .setColor(getColor('primary'))
                .setTitle('Autoresponders')
                .setDescription(
                    list
                        .slice(0, 25)
                        .map((entry, i) => `**${i + 1}.** \`${entry.trigger}\` — ${entry.matchType}`)
                        .join('\n'),
                )
                .setFooter({ text: `${list.length} total` });

            return InteractionHelper.safeEditReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};
