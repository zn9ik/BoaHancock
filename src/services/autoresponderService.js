// autoresponderService.js — CRUD + matching for keyword auto-responses.
// Stored inside the guild's existing config JSONB under `autoresponders`,
// so no new table/migration is needed.

import { randomUUID } from 'crypto';
import { getGuildConfig, updateGuildConfig } from './config/guildConfig.js';

const MAX_AUTORESPONDERS_PER_GUILD = 100;
const MAX_TRIGGER_LENGTH = 200;
const MAX_RESPONSE_LENGTH = 2000;

export async function getAutoresponders(client, guildId) {
    const config = await getGuildConfig(client, guildId);
    return Array.isArray(config.autoresponders) ? config.autoresponders : [];
}

export async function addAutoresponder(client, guildId, entry) {
    const list = await getAutoresponders(client, guildId);

    if (list.length >= MAX_AUTORESPONDERS_PER_GUILD) {
        throw new Error(`This server already has the maximum of ${MAX_AUTORESPONDERS_PER_GUILD} autoresponders.`);
    }

    const trigger = entry.trigger.trim().slice(0, MAX_TRIGGER_LENGTH);
    if (!trigger) {
        throw new Error('Trigger cannot be empty.');
    }

    const duplicate = list.find((item) => item.trigger.toLowerCase() === trigger.toLowerCase());
    if (duplicate) {
        throw new Error(`A trigger matching "${trigger}" already exists. Remove it first if you want to replace it.`);
    }

    const record = {
        id: randomUUID(),
        trigger,
        matchType: entry.matchType === 'exact' ? 'exact' : 'contains',
        response: entry.response ? entry.response.slice(0, MAX_RESPONSE_LENGTH) : null,
        embed: entry.embed && (entry.embed.title || entry.embed.description)
            ? {
                title: entry.embed.title ? entry.embed.title.slice(0, 256) : null,
                description: entry.embed.description ? entry.embed.description.slice(0, 4096) : null,
                color: entry.embed.color || null,
            }
            : null,
        image: entry.image || null,
        createdBy: entry.createdBy,
        createdAt: Date.now(),
    };

    if (!record.response && !record.embed && !record.image) {
        throw new Error('Provide a text response, embed content, or an image.');
    }

    const updated = [...list, record];
    await updateGuildConfig(client, guildId, { autoresponders: updated });
    return record;
}

export async function removeAutoresponder(client, guildId, trigger) {
    const list = await getAutoresponders(client, guildId);
    const normalized = trigger.trim().toLowerCase();
    const match = list.find((item) => item.trigger.toLowerCase() === normalized);

    if (!match) {
        throw new Error(`No autoresponder found with trigger "${trigger}".`);
    }

    const updated = list.filter((item) => item.id !== match.id);
    await updateGuildConfig(client, guildId, { autoresponders: updated });
    return match;
}

// Returns the first matching autoresponder for a given message, or null.
export function findMatchingAutoresponder(list, content) {
    if (!Array.isArray(list) || !content) return null;

    const normalizedContent = content.trim().toLowerCase();
    if (!normalizedContent) return null;

    for (const entry of list) {
        const trigger = entry.trigger?.toLowerCase();
        if (!trigger) continue;

        if (entry.matchType === 'exact') {
            if (normalizedContent === trigger) return entry;
        } else {
            if (normalizedContent.includes(trigger)) return entry;
        }
    }

    return null;
}

export function buildAutoresponderPayload(entry) {
    const payload = {};

    if (entry.response) {
        payload.content = entry.response;
    }

    if (entry.embed || (entry.image && !entry.response)) {
        const embed = {};
        if (entry.embed?.title) embed.title = entry.embed.title;
        if (entry.embed?.description) embed.description = entry.embed.description;
        if (entry.embed?.color) {
            const hex = entry.embed.color.replace('#', '');
            embed.color = parseInt(hex, 16);
        }
        if (entry.image) embed.image = { url: entry.image };
        payload.embeds = [embed];
    } else if (entry.image) {
        payload.content = payload.content
            ? `${payload.content}\n${entry.image}`
            : entry.image;
    }

    return payload;
}
