// index.mjs

import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from 'dotenv';
import { commandsRouter } from './commands.mjs';
import { handleSearchSessionInput } from './searchHandler.mjs';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();

  // If the user is mid-search-session, process that input before anything else.
  const handledInSession = await handleSearchSessionInput(message);
  if (handledInSession) return;

  // Only process commands starting with !
  if (!content.startsWith('!')) return;

  try {
    const handled = await commandsRouter(message);
    if (!handled) {
      await message.channel.send("Unknown command. Please try again or use !info for help.");
    }
  } catch (err) {
    console.error('Message routing error:', err);
    await message.channel.send(`❌ Unexpected error: ${err.message || err}`);
  }
});

client.login(process.env.DISCORD_TOKEN);
