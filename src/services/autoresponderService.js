// autoresponderService.js — CRUD + matching for keyword auto-responses.
// Stored inside the guild's existing config JSONB under `autoresponders`,
// so no new table/migration is needed.

import { randomUUID } from 'crypto';
import { getGuildConfig, updateGuildConfig } from './config/guildConfig.js';

const MAX_AUTORESPONDERS_PER_GUILD = 100;
const MAX_TRIGGER_LENGTH = 200;
const MAX_REPLY_LENGTH = 2000;

export async function getAutoresponders(client, guildId) {
    const config = await getGuildConfig(client, guildId);
    return Array.isArray(config.autoresponders) ? config.autoresponders : [];
}

function findByTrigger(list, trigger) {
    const normalized = trigger.trim().toLowerCase();
    return list.find((item) => item.trigger.toLowerCase() === normalized);
}

export async function addAutoresponder(client, guildId, { trigger, matchType, reply, createdBy }) {
    const list = await getAutoresponders(client, guildId);

    if (list.length >= MAX_AUTORESPONDERS_PER_GUILD) {
        throw new Error(`This server already has the maximum of ${MAX_AUTORESPONDERS_PER_GUILD} autoresponders.`);
    }

    const cleanTrigger = trigger.trim().slice(0, MAX_TRIGGER_LENGTH);
    if (!cleanTrigger) {
        throw new Error('Trigger cannot be empty.');
    }

    const cleanReply = reply.trim().slice(0, MAX_REPLY_LENGTH);
    if (!cleanReply) {
        throw new Error('Reply cannot be empty.');
    }

    if (findByTrigger(list, cleanTrigger)) {
        throw new Error(`An autoresponder with trigger "${cleanTrigger}" already exists. Use \`/autoresponder editreply\` or remove it first.`);
    }

    const record = {
        id: randomUUID(),
        trigger: cleanTrigger,
        matchType: matchType === 'exact' ? 'exact' : 'contains',
        reply: cleanReply,
        createdBy,
        createdAt: Date.now(),
    };

    await updateGuildConfig(client, guildId, { autoresponders: [...list, record] });
    return record;
}

export async function removeAutoresponder(client, guildId, trigger) {
    const list = await getAutoresponders(client, guildId);
    const match = findByTrigger(list, trigger);

    if (!match) {
        throw new Error(`No autoresponder found with trigger "${trigger}".`);
    }

    await updateGuildConfig(client, guildId, {
        autoresponders: list.filter((item) => item.id !== match.id),
    });
    return match;
}

export async function editAutoresponderMatchMode(client, guildId, trigger, matchType) {
    const list = await getAutoresponders(client, guildId);
    const match = findByTrigger(list, trigger);

    if (!match) {
        throw new Error(`No autoresponder found with trigger "${trigger}".`);
    }

    const updatedRecord = { ...match, matchType: matchType === 'exact' ? 'exact' : 'contains' };
    const updatedList = list.map((item) => (item.id === match.id ? updatedRecord : item));
    await updateGuildConfig(client, guildId, { autoresponders: updatedList });
    return updatedRecord;
}

export async function editAutoresponderReply(client, guildId, trigger, reply) {
    const list = await getAutoresponders(client, guildId);
    const match = findByTrigger(list, trigger);

    if (!match) {
        throw new Error(`No autoresponder found with trigger "${trigger}".`);
    }

    const cleanReply = reply.trim().slice(0, MAX_REPLY_LENGTH);
    if (!cleanReply) {
        throw new Error('Reply cannot be empty.');
    }

    const updatedRecord = { ...match, reply: cleanReply };
    const updatedList = list.map((item) => (item.id === match.id ? updatedRecord : item));
    await updateGuildConfig(client, guildId, { autoresponders: updatedList });
    return updatedRecord;
}

export async function getAutoresponderByTrigger(client, guildId, trigger) {
    const list = await getAutoresponders(client, guildId);
    return findByTrigger(list, trigger) || null;
}

export async function resetAutoresponders(client, guildId) {
    const list = await getAutoresponders(client, guildId);
    await updateGuildConfig(client, guildId, { autoresponders: [] });
    return list.length;
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
        } else if (normalizedContent.includes(trigger)) {
            return entry;
        }
    }

    return null;
}
