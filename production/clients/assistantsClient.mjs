// assistantsClient.mjs

import OpenAI from 'openai';
// import { getUserMemoryLog, appendUserMemoryLog } from './sqlClient.mjs'; // REM removed

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const COMMAND_INDEX = `
You are Archy, a Discord assistant bot. The available commands are:

!ping - Respond with Pong to check bot responsiveness.
!summary - Generate a concise summary of the current conversation.
!retag - Generate relevant tags for the current ticket.
!ghostbusters - List active Node.js processes on the server.
!info - Show information about the bot and available commands.

Always respond with knowledge of these commands when appropriate.
`;

/**
 * AI interpret function for summary, tags, and metadata extraction.
 * Rolling user memory and REM is removed for minimal build.
 * @param {string|Array<Object>} promptOrMessages
 * @param {Object} [options]
 * @param {string} [userId]
 * @returns {Promise<string>}
 */
export async function aiInterpret(promptOrMessages, options = {}, userId) {
  let messages = [];

  if (Array.isArray(promptOrMessages)) {
    messages = promptOrMessages;
  } else {
    messages = [{ role: 'user', content: promptOrMessages }];
  }

  // No memory entries, just the command index and user prompt
  const systemPrompt = {
    role: 'system',
    content: COMMAND_INDEX,
  };

  const fullMessages = [systemPrompt, ...messages];

  const defaultOptions = {
    model: process.env.ARCHYBOT_MODEL || 'gpt-4o-mini',
    temperature: 0.4,
  };
  const callOptions = { ...defaultOptions, ...options };

  const response = await openai.chat.completions.create({
    model: callOptions.model,
    temperature: callOptions.temperature,
    messages: fullMessages,
  });

  const reply = response.choices[0].message.content.trim();

  // No memory logging
  return reply;
}

/**
 * Extract metadata from message logs via AI.
 * Ensures correct types for all schema fields and never blocks archiving.
 * @param {Array} messageLog - Array of {author, content} objects.
 * @returns {Promise<Object>} Parsed metadata object.
 */
export async function extractMetadataFromMessages(messageLog) {
  const systemPrompt = {
    role: 'system',
    content: `
You are a metadata extractor for Discord ticket logs. Extract *only* the following fields and output valid JSON:
- "sale_id": External reference ID, typically SID-000XXXXXX (string, "UNKNOWN" if absent)
- "staff": Array of staff usernames (empty array if none)
- "quoted": Numeric value (USD, e.g., quoted/estimated/approved price, or null if not present)
- "tags": Array of keywords relevant to the ticket (empty array if none)

"quoted" must be a number if present, or null if not found. Do not use currency symbols or text. Do not output any value other than a number or null for "quoted".

If a field is missing or unknown, return it as specified: "sale_id" as "UNKNOWN", "staff" as empty array, "quoted" as null, "tags" as empty array.

Example output:
{"sale_id":"sid-000123456","staff":["user1"],"quoted":1299.99,"tags":["pump","repair"]}

Return only valid JSON and no extra commentary.
`.trim(),
  };
  const userPrompt = {
    role: 'user',
    content: JSON.stringify(messageLog),
  };

  const response = await aiInterpret([systemPrompt, userPrompt], { model: 'gpt-4o-mini' });
  let parsed = null;
  try {
    parsed = JSON.parse(response);
  } catch {
    parsed = { sale_id: 'UNKNOWN', staff: [], quoted: null, tags: [] };
  }

  // Strictly enforce output types
  let sale_id =
    typeof parsed.sale_id === 'string' && parsed.sale_id.trim()
      ? parsed.sale_id
      : 'UNKNOWN';
  let staff = Array.isArray(parsed.staff) ? parsed.staff : [];
  let quoted =
    typeof parsed.quoted === 'number' && !isNaN(parsed.quoted)
      ? parsed.quoted
      : null;
  let tags = Array.isArray(parsed.tags) ? parsed.tags : [];

  return { sale_id, staff, quoted, tags };
}

/**
 * Validates metadata schema.
 * @param {Object} metadata
 * @returns {Object} Validation result {valid: boolean, issues: Array<string>}
 */
export function validateMetadataSchema(metadata) {
  if (!metadata) return { valid: false, issues: ['No metadata found'] };
  if (typeof metadata.sale_id !== 'string') return { valid: false, issues: ['sale_id must be string'] };
  if (!Array.isArray(metadata.staff)) return { valid: false, issues: ['staff must be array'] };
  if (metadata.quoted !== null && typeof metadata.quoted !== 'number') return { valid: false, issues: ['quoted must be number or null'] };
  if (!Array.isArray(metadata.tags)) return { valid: false, issues: ['tags must be array'] };
  return { valid: true, issues: [] };
}

/**
 * Summarize a list of Discord messages using the AI assistant.
 * Always summarizes the entire message log provided.
 * @param {Array} messages - Array of {author, content}
 * @returns {Promise<string>} summary text
 */
export async function runAssistantForSummary(messages) {
  const log = Array.isArray(messages)
    ? messages.map(m =>
        typeof m === 'object' && m.author && m.content
          ? { author: m.author, content: m.content }
          : m
      )
    : [];

  const summary = await aiInterpret(
    [
      {
        role: "system",
        content: "You are Archy, a helpful assistant that summarizes ticket issues and resolutions. Summarize the following conversation concisely based on the full log provided.",
      },
      {
        role: "user",
        content: `Summarize the following conversation concisely:\n${JSON.stringify(log)}`,
      }
    ]
  );
  return summary;
}
