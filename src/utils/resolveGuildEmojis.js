// resolveGuildEmojis.js — replaces `:emojiname:` shortcodes typed by a user
// with the guild's actual custom emoji (so typed text renders as the real
// server emoji), since Discord modals have no emoji picker.

const SHORTCODE_PATTERN = /:([a-zA-Z0-9_]{2,32}):/g;

export function resolveGuildEmojis(content, guild) {
    if (!content || !guild) return content;

    return content.replace(SHORTCODE_PATTERN, (match, name) => {
        const emoji = guild.emojis.cache.find(
            (e) => e.name?.toLowerCase() === name.toLowerCase(),
        );

        if (!emoji) return match;

        return emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
    });
}
