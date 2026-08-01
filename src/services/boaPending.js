// boaPending.js — holds channel/attachment between the initial `/boa` slash
// command and the modal that follows it, since modals can't carry
// attachment/channel-select data directly.

export const pendingBoaMessages = new Map();

export function takePendingBoaMessage(key) {
    const entry = pendingBoaMessages.get(key);
    pendingBoaMessages.delete(key);

    if (!entry) return null;
    if (entry.expiresAt < Date.now()) return null;

    return entry;
}
