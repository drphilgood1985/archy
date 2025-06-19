export function isAffirmative(msg = "") {
  if (!msg || typeof msg !== "string") return false;
  const affirmatives = [
    "yes", "sure", "go ahead", "yep", "okay", "confirm", "please do", "do it", "proceed", "sounds good"
  ];
  return affirmatives.some(str =>
    msg.trim().toLowerCase().replace(/[.!?]/g, "").startsWith(str)
  );
}

export function isNegative(msg = "") {
  if (!msg || typeof msg !== "string") return false;
  const negatives = [
    "no", "cancel", "stop", "don't", "do not", "never mind", "abort", "not now"
  ];
  return negatives.some(str =>
    msg.trim().toLowerCase().replace(/[.!?]/g, "").startsWith(str)
  );
}

export function parseCommand(msg = "") {
  if (!msg || typeof msg !== "string") return null;
  const cmd = msg.trim().toLowerCase().split(/\s+/)[0];
  const valid = ["!ping", "!info", "!archive", "!summary", "!retag", "!ghostbusters", "!search", "!thanks"];
  if (valid.includes(cmd)) return cmd;
  return null;
}

// Returns true if a Discord message object is a valid text message for AI summary/tagging
export function isValidTextMessage(msg) {
  // Exclude null/undefined, bots, and empty strings
  if (!msg) return false;
  if (msg.author?.bot) return false;
  if (typeof msg.content !== "string" || msg.content.trim().length === 0) return false;
  // Exclude messages with attachments (media, files)
  if (msg.attachments && msg.attachments.size > 0) return false;
  // Exclude system messages if applicable (optional, add as needed)
  return true;
}
// Validates if a channelId exists in the client's cached channels (basic synchronous check)
export async function validateChannelId(client, channelId) {
  try {
    if (!client || !client.channels) return false;
    // Try fetching the channel from Discord to confirm existence
    const channel = await client.channels.fetch(channelId);
    return !!channel;
  } catch {
    return false;
  }
}
