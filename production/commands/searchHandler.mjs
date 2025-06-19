// searchHandler.mjs

import {
  semanticSearch,
} from './pineconeClient.mjs';
import {
  queryTicketByKeywords,
  fetchTicketMessages,
} from './sqlClient.mjs';
import { runAssistantForSummary } from './assistantsClient.mjs';
import { handleRestoreCommand } from './retrievalHandler.mjs';

const userAdHocState = new Map();

export async function handleSearchCommand(message, args) {
  const userQuery = args.join(' ').trim();
  if (!userQuery) {
    await message.channel.send('❌ Please provide search keywords.');
    return;
  }

  let tickets = [];
  try {
    tickets = await semanticSearch(userQuery);
  } catch (err) {
    console.error("Pinecone search failed, falling back to keyword search.", err);
    tickets = [];
  }

  if (!tickets || tickets.length === 0) {
    tickets = await queryTicketByKeywords(userQuery);
  }

  if (!tickets || tickets.length === 0) {
    await message.channel.send('No matching tickets found.');
    return;
  }

  // Limit to 5 results for clarity
  const results = tickets.slice(0, 5);

  const formatted = results.map((t, idx) => {
    const title = t.property_name || t.ticket_title || t.channel_id || '(untitled)';
    const date = t.created_at ? ` (${(new Date(t.created_at)).toLocaleDateString()})` : '';
    const summary = t.summary ? ` - ${t.summary}` : '';
    return `\`${idx + 1}\` • **${title}**${date}${summary}`;
  });

  await message.channel.send(
    `**Search results for:** \`${userQuery}\`\n${formatted.join('\n')}\n\nReply with the result number (1-${results.length}) to select a ticket.`
  );

  userAdHocState.set(message.author.id, {
    step: "awaiting_selection",
    results,
    channel: message.channel,
  });
}

// Listen for next user message for selection and intent
export async function handleSearchSessionInput(message) {
  const userId = message.author.id;
  const state = userAdHocState.get(userId);
  if (!state) return false;

  const input = message.content.trim().toLowerCase();

  if (state.step === "awaiting_selection") {
    const num = parseInt(input, 10);
    if (isNaN(num) || num < 1 || num > state.results.length) {
      await message.channel.send(`Please reply with a number between 1 and ${state.results.length}.`);
      return true;
    }
    const ticket = state.results[num - 1];
    state.selectedTicket = ticket;
    state.step = "awaiting_action";
    await message.channel.send(
      `Selected: **${ticket.property_name || ticket.ticket_title || ticket.channel_id || 'untitled'}**.\nReply \`summary\` for a summary, or \`restore\` for the full log (with media) in a new thread.`
    );
    return true;
  }

  if (state.step === "awaiting_action") {
    if (input === "summary") {
      // Fetch messages, exclude media/bot for AI
      const messages = await fetchTicketMessages(state.selectedTicket.id);
      const log = messages
        .filter(msg => typeof msg.content === "string" && msg.content.trim().length > 0)
        .map(msg => ({
          author: msg.author,
          content: msg.content,
        }));
      const summary = await runAssistantForSummary(log);
      await message.channel.send(`📄 Summary for **${state.selectedTicket.property_name || state.selectedTicket.ticket_title || 'ticket'}**:\n${summary}`);
      userAdHocState.delete(userId);
      return true;
    }
    if (input === "restore" || input === "full log" || input === "details") {
      await handleRestoreCommand(message, state.selectedTicket.id);
      userAdHocState.delete(userId);
      return true;
    }
    await message.channel.send('Please reply with either `summary` or `restore`.');
    return true;
  }

  return false;
}
