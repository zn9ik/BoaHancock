// autoresponderPending.js — holds trigger/matchType/image between the initial
// `/autoresponder add` slash command and the modal submit that follows it,
// since modals can't carry attachment data directly.

export const pendingAutoresponders = new Map();

export function takePendingAutoresponder(key) {
    const entry = pendingAutoresponders.get(key);
    pendingAutoresponders.delete(key);

    if (!entry) return null;
    if (entry.expiresAt < Date.now()) return null;

    return entry;
}
