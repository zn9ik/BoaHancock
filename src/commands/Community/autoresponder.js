import { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { getColor, isBotOwner } from '../../config/bot.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { successEmbed } from '../../utils/embeds.js';
import {
    getAutoresponders,
    addAutoresponder,
    removeAutoresponder,
    editAutoresponderMatchMode,
    editAutoresponderReply,
    getAutoresponderByTrigger,
    resetAutoresponders,
} from '../../services/autoresponderService.js';

function hasAutoresponderAccess(interaction) {
    return isBotOwner(interaction.user.id) || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function accessDenied(interaction) {
    return replyUserError(interaction, {
        type: ErrorTypes.PERMISSION,
        message: 'You need Administrator permission (or be the bot owner) to manage autoresponders.',
    });
}

const matchModeChoices = [
    { name: 'Contains (trigger can appear anywhere in the message)', value: 'contains' },
    { name: 'Exact match (message must equal the trigger)', value: 'exact' },
];

export default {
    data: new SlashCommandBuilder()
        .setName('autoresponder')
        .setDescription('Manage keyword-triggered auto-responses for this server')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((sub) =>
            sub
                .setName('add')
                .setDescription('Add an autoresponder')
                .addStringOption((opt) => opt.setName('trigger').setDescription('The trigger for your ar').setRequired(true).setMaxLength(200))
                .addStringOption((opt) => opt.setName('reply').setDescription('What the bot should reply with').setRequired(true).setMaxLength(2000))
                .addStringOption((opt) =>
                    opt.setName('match_mode').setDescription('How the trigger is matched (default: contains)').setRequired(false).addChoices(...matchModeChoices),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('remove')
                .setDescription('Remove an autoresponder')
                .addStringOption((opt) => opt.setName('trigger').setDescription('The exact trigger to remove').setRequired(true).setMaxLength(200)),
        )
        .addSubcommand((sub) =>
            sub
                .setName('editmatchmode')
                .setDescription('Edit the match mode of an autoresponder')
                .addStringOption((opt) => opt.setName('trigger').setDescription('The trigger to edit').setRequired(true).setMaxLength(200))
                .addStringOption((opt) => opt.setName('match_mode').setDescription('New match mode').setRequired(true).addChoices(...matchModeChoices)),
        )
        .addSubcommand((sub) =>
            sub
                .setName('editreply')
                .setDescription('Edit the reply of an autoresponder')
                .addStringOption((opt) => opt.setName('trigger').setDescription('The trigger to edit').setRequired(true).setMaxLength(200))
                .addStringOption((opt) => opt.setName('reply').setDescription('New reply').setRequired(true).setMaxLength(2000)),
        )
        .addSubcommand((sub) => sub.setName('list').setDescription("List the autoresponders your server has"))
        .addSubcommand((sub) =>
            sub
                .setName('show')
                .setDescription('Show an autoresponder')
                .addStringOption((opt) => opt.setName('trigger').setDescription('The trigger to show').setRequired(true).setMaxLength(200)),
        )
        .addSubcommand((sub) =>
            sub
                .setName('showraw')
                .setDescription("Show an autoresponder's raw reply")
                .addStringOption((opt) => opt.setName('trigger').setDescription('The trigger to show').setRequired(true).setMaxLength(200)),
        )
        .addSubcommand((sub) => sub.setName('reset').setDescription("Resets all of this server's autoresponders")),

    category: 'community',

    async execute(interaction, _config, client) {
        if (!hasAutoresponderAccess(interaction)) {
            return accessDenied(interaction);
        }

        const subcommand = interaction.options.getSubcommand();

        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) {
            logger.warn('Autoresponder interaction defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                subcommand,
            });
            return;
        }

        try {
            if (subcommand === 'add') {
                const trigger = interaction.options.getString('trigger');
                const reply = interaction.options.getString('reply');
                const matchMode = interaction.options.getString('match_mode') || 'contains';

                const record = await addAutoresponder(client, interaction.guildId, {
                    trigger,
                    matchType: matchMode,
                    reply,
                    createdBy: interaction.user.id,
                });

                const embed = new EmbedBuilder()
                    .setColor(getColor('success'))
                    .setTitle('created autoresponder!')
                    .setDescription(`**${interaction.guild.name}**\ncreated autoresponder`)
                    .addFields(
                        { name: 'trigger', value: record.trigger, inline: true },
                        { name: 'match mode', value: record.matchType, inline: true },
                        { name: 'reply', value: record.reply.length > 1000 ? `${record.reply.slice(0, 997)}...` : record.reply },
                    );

                return InteractionHelper.safeEditReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            if (subcommand === 'remove') {
                const trigger = interaction.options.getString('trigger');
                const removed = await removeAutoresponder(client, interaction.guildId, trigger);
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed('Autoresponder Removed', `Removed the trigger "${removed.trigger}".`)],
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (subcommand === 'editmatchmode') {
                const trigger = interaction.options.getString('trigger');
                const matchMode = interaction.options.getString('match_mode');
                const updated = await editAutoresponderMatchMode(client, interaction.guildId, trigger, matchMode);
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed('Match Mode Updated', `"${updated.trigger}" is now set to **${updated.matchType}**.`)],
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (subcommand === 'editreply') {
                const trigger = interaction.options.getString('trigger');
                const reply = interaction.options.getString('reply');
                const updated = await editAutoresponderReply(client, interaction.guildId, trigger, reply);
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed('Reply Updated', `Updated the reply for "${updated.trigger}".`)],
                    flags: MessageFlags.Ephemeral,
                });
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

            if (subcommand === 'show' || subcommand === 'showraw') {
                const trigger = interaction.options.getString('trigger');
                const entry = await getAutoresponderByTrigger(client, interaction.guildId, trigger);

                if (!entry) {
                    return replyUserError(interaction, {
                        type: ErrorTypes.VALIDATION,
                        message: `No autoresponder found with trigger "${trigger}".`,
                    });
                }

                if (subcommand === 'showraw') {
                    const raw = entry.reply.replace(/`/g, '\\`');
                    return InteractionHelper.safeEditReply(interaction, {
                        content: `Raw reply for \`${entry.trigger}\`:\n\`\`\`\n${raw}\n\`\`\``,
                        flags: MessageFlags.Ephemeral,
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor(getColor('primary'))
                    .setTitle(entry.trigger)
                    .addFields(
                        { name: 'match mode', value: entry.matchType, inline: true },
                        { name: 'reply', value: entry.reply.length > 1000 ? `${entry.reply.slice(0, 997)}...` : entry.reply },
                    );

                return InteractionHelper.safeEditReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            if (subcommand === 'reset') {
                const count = await resetAutoresponders(client, interaction.guildId);
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed('Autoresponders Reset', `Removed ${count} autoresponder(s) from this server.`)],
                    flags: MessageFlags.Ephemeral,
                });
            }
        } catch (error) {
            return replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: error.message });
        }
    },
};
