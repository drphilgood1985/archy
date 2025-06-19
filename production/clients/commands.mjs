// commands.mjs

import * as validator from './validator.mjs';
import { handleArchiveCommand } from './archiveHandler.mjs';
import { handleSearchCommand } from './searchHandler.mjs';

// -- Helper to fetch ALL messages in a channel (for !summary, !retag, etc) --
async function fetchAllMessages(channel) {
  try {
    let allMessages = [];
    let lastId = null;
    let attempts = 0;
    while (true) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;
      const messages = await channel.messages.fetch(options);
      if (!messages || messages.size === 0) break;
      allMessages = allMessages.concat(Array.from(messages.values()));
      lastId = messages.last().id;
      attempts++;
      if (attempts > 100) {
        console.error('fetchAllMessages: Too many attempts, aborting.');
        break;
      }
    }
    // Return all messages (oldest first, includes media)
    return allMessages
      .filter(m => m)
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  } catch (err) {
    console.error('fetchAllMessages error:', err);
    return [];
  }
}

// -- Helper to fetch ONLY new messages since last archive (for archiving) --
async function fetchNewMessages(channel, lastTimestamp) {
  try {
    let allMessages = [];
    let lastId = null;
    let done = false;
    let attempts = 0;
    while (!done) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;
      const messages = await channel.messages.fetch(options);
      if (!messages || messages.size === 0) break;
      for (const msg of messages.values()) {
        if (msg.createdTimestamp > lastTimestamp) {
          allMessages.push(msg);
        } else {
          done = true;
          break;
        }
      }
      lastId = messages.last().id;
      attempts++;
      if (attempts > 100) {
        console.error('fetchNewMessages: Too many attempts, aborting.');
        break;
      }
      if (done) break;
    }
    // Return all new messages (oldest first, includes media)
    return allMessages
      .filter(m => m)
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  } catch (err) {
    console.error('fetchNewMessages error:', err);
    return [];
  }
}

// -- Handler for !summary --
async function handleSummaryCommand(message, messageLog, speedMode = false) {
  const MAX_SUMMARY_MESSAGES = 150;
  if (!Array.isArray(messageLog) || messageLog.length === 0) {
    await message.channel.send('❌ No messages to summarize.');
    return null;
  }
  // Filter for valid text messages only
  let log = messageLog
    .filter(msg => validator.isValidTextMessage(msg))
    .map(msg => ({
      author: msg.author,
      content: msg.content
    }));
  if (log.length > MAX_SUMMARY_MESSAGES) {
    await message.channel.send(`⚠️ Ticket log is very large. Summarizing the last ${MAX_SUMMARY_MESSAGES} messages only.`);
    log = log.slice(-MAX_SUMMARY_MESSAGES);
  }
  const { aiInterpret } = await import('./assistantsClient.mjs');
  const userId = message.author.id;
  const prompt = [
    {
      role: "system",
      content: "You are Archy, a helpful assistant that summarizes ticket issues and resolutions. Summarize the following conversation concisely based on the full log provided."
    },
    {
      role: "user",
      content: `Summarize the following conversation concisely:\n${JSON.stringify(log)}`
    }
  ];
  try {
    const summary = await aiInterpret(prompt, {}, userId);
    if (!speedMode) {
      await message.channel.send(`📄 Summary:\n${summary}`);
    }
    return summary;
  } catch (error) {
    console.error('Error generating summary:', error);
    await message.channel.send('❌ Failed to generate summary.');
    return null;
  }
}

// -- Handler for !retag --
async function handleRetagCommand(message, messageLog, speedMode = false) {
  // Filter for valid text messages only
  let log = messageLog
    .filter(msg => validator.isValidTextMessage(msg))
    .map(msg => ({
      author: msg.author,
      content: msg.content
    }));
  const { aiInterpret } = await import('./assistantsClient.mjs');
  const userId = message.author.id;
  const prompt = `Generate relevant tags for the following conversation:\n${JSON.stringify(log)}`;
  try {
    const tags = await aiInterpret(prompt, {}, userId);
    if (!speedMode) {
      await message.channel.send(`🏷️ Tags:\n${tags}`);
    }
    return tags;
  } catch {
    await message.channel.send('❌ Failed to generate tags.');
    return null;
  }
}

// -- Handler for !ghostbusters --
async function handleGhostbustersCommand(message) {
  const { exec } = await import('child_process');
  console.log(`[Ghostbusters] PID: ${process.pid}`);
  exec('tasklist', async (error, stdout) => {
    try {
      if (error) {
        await message.channel.send(`Error listing tasks: ${error.message}`);
        return;
      }
      const nodeProcesses = stdout
        .split('\n')
        .filter(line => line.toLowerCase().includes('node.exe'));
      if (nodeProcesses.length === 0) {
        await message.channel.send('No orphaned Node.js processes found.');
        return;
      }
      // Discord message character limit: 2000
      const joined = nodeProcesses.join('\n');
      await message.channel.send(`Found Node.js processes:\n${joined.slice(0, 2000)}`);
    } catch (err) {
      console.error('Ghostbusters handler error:', err);
    }
  });
}

// -- Handler for !ping --
async function handlePingCommand(message) {
  await message.channel.send('🏓 Pong!');
}


// -- Handler for !info --
async function handleInfoCommand(message) {
  const infoMessage = `
**ArchyBot Info:**
- Version: 1.0.0
- Developed by SCMG RepairHub Team
- Commands available: !ping, !summary, !retag, !archive, !ghostbusters, !info, !search
- For support, contact admin.
  `.trim();
  await message.channel.send(infoMessage);
}

// -- Centralized command router --
async function commandsRouter(message) {
  const content = message.content.trim();
  const cmd = validator.parseCommand(content);

  try {
    switch (cmd) {
      case '!ping':
        await handlePingCommand(message);
        return true;
      case '!info':
        await handleInfoCommand(message);
        return true;
      case '!archive':
        await handleArchiveCommand(message);
        return true;
      case '!summary': {
        const messages = await fetchAllMessages(message.channel);
        if (!Array.isArray(messages) || messages.length === 0) {
          await message.channel.send('❌ Unable to fetch messages for summary. Please check bot permissions.');
          return true;
        }
        // Only include valid text messages for AI
        const messageLog = messages.filter(msg => validator.isValidTextMessage(msg));
        await handleSummaryCommand(message, messageLog, false);
        return true;
      }
      case '!retag': {
        const messages = await fetchAllMessages(message.channel);
        if (!Array.isArray(messages) || messages.length === 0) {
          await message.channel.send('❌ Unable to fetch messages for tagging. Please check bot permissions.');
          return true;
        }
        // Only include valid text messages for AI
        const messageLog = messages.filter(msg => validator.isValidTextMessage(msg));
        await handleRetagCommand(message, messageLog, false);
        return true;
      }      case '!ghostbusters':
        await handleGhostbustersCommand(message);
        return true;
      case '!search': {
        const args = content.slice('!search'.length).trim().split(/\s+/);
        await handleSearchCommand(message, args);
        return true;
      }
      case '!thanks':
        await message.channel.send("Thank you! If you need more help, just ask.");
        return true;
      default:
        await message.channel.send("Unknown command. Please try again or use !info for help.");
        return false;
    }
  } catch (err) {
    console.error('Command error:', err);
    await message.channel.send(`❌ Command failed: ${err.message || err}`);
    return true;
  }
}

export {
  fetchAllMessages,
  fetchNewMessages,
  handlePingCommand,
  handleSummaryCommand,
  handleRetagCommand,
  handleGhostbustersCommand,
  handleInfoCommand,
  commandsRouter
};
