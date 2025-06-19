// archiveHandler.mjs

import { fetchAllMessages, fetchNewMessages, handleSummaryCommand, handleRetagCommand } from './commands.mjs';
import { validateChannelId } from './validator.mjs';
import {
  insertTicketMetadata,
  updateTicketMetadata,
  insertTicketMessage,
  insertTicketFile,
  fetchTicketMetadataByChannelId
} from './sqlClient.mjs';
import { extractMetadataFromMessages, validateMetadataSchema } from './assistantsClient.mjs';
import axios from 'axios';

export async function handleArchiveCommand(message) {
  try {
    // Channel validation: ensure the channel exists and is not deleted
    const client = message.client;
    const channelId = message.channel.id;
    const channelValid = await validateChannelId(client, channelId);
    if (!channelValid) {
      console.log('❌ Cannot archive: this channel no longer exists.');
      return;
    }

    let channel = await client.channels.fetch(channelId);

    // Role validation (optional, customize for your needs)
    const allowedRoles = ['Director of Repairs', 'Asst Director', 'Director of Maintenance', 'Manager'];
    let hasDirectorRole = false;
    if (message.guild && message.member) {
      hasDirectorRole = message.member?.roles?.cache.some(role => allowedRoles.includes(role.name));
      if (!hasDirectorRole) {
        await channel.send('🔐 You do not have permission to archive this ticket.');
        return;
      }
    }

    // Block threads from being archived
    if (channel.isThread && channel.isThread()) {
      await channel.send("❌ Archive is not supported in threads. Please run this command in a main channel.");
      return;
    }

    // Find last archive time for this channel
    const existingMeta = await fetchTicketMetadataByChannelId(channel.id);
    let lastArchiveTime = null;
    if (existingMeta && existingMeta.created_at) {
      lastArchiveTime = new Date(existingMeta.created_at).getTime();
    }

    // Prefer fetching only new messages since last archive, fallback to all if none found
    let sortedMessages = [];
    if (lastArchiveTime) {
      sortedMessages = await fetchNewMessages(channel, lastArchiveTime);
      if (sortedMessages.length === 0) {
        sortedMessages = await fetchAllMessages(channel);
      }
    } else {
      sortedMessages = await fetchAllMessages(channel);
    }

    if (sortedMessages.length === 0) {
      await channel.send('❌ No messages found to archive.');
      return;
    }

    const speedMode = message.content.includes('speed');
    if (speedMode) {
      await channel.send('⚡ Speed archive mode activated!');
    }

    // CHUNKED ARCHIVING SECTION (if needed, for extremely large logs)
    const CHUNK_SIZE = 50;
    let archivedCount = 0;
    const totalMessages = sortedMessages.length;
    let summary = '';
    let tags = [];
    let metadata = null;
    let propertyName = '';

    while (archivedCount < totalMessages) {
      const chunk = sortedMessages.slice(archivedCount, archivedCount + CHUNK_SIZE);

      // Prepare messageLog for AI/DB—filter only for text, exclude media for AI
      const messageLog = chunk
        .filter(msg => typeof msg.content === 'string' && msg.content.trim().length > 0)
        .map(msg => ({
          author: msg.author?.username || 'unknown',
          content: msg.content
        }));

      // Only run summary/tag extraction for first chunk
      if (archivedCount === 0) {
        // Only text messages, no media, for summary/tag/metadata
        const textLog = messageLog;

        // Truncate to safe token budget
        const SAFE_TOKEN_CHAR_LIMIT = 8000 * 4; // ~4 chars/token
        let charTotal = 0;
        let truncatedLog = [];
        for (const entry of textLog) {
          const msgStr = `${entry.author}: ${entry.content}\n`;
          if (charTotal + msgStr.length > SAFE_TOKEN_CHAR_LIMIT) break;
          truncatedLog.push(entry);
          charTotal += msgStr.length;
        }

        summary = await handleSummaryCommand(message, truncatedLog, true); // speedMode suppresses channel spam
        tags = await handleRetagCommand(message, truncatedLog, true);
        propertyName = truncatedLog.find(m => m.content && m.content.length < 100)?.content?.split(' ')[0] || 'Unknown';
        metadata = await extractMetadataFromMessages(truncatedLog);

        if (metadata && (typeof metadata.quoted !== 'number' || isNaN(metadata.quoted))) {
          metadata.quoted = null;
        }
        const validation = validateMetadataSchema(metadata);
        if (!validation.valid) {
          console.error('Metadata validation failed:', validation.issues);
          await channel.send('❌ Archive aborted due to metadata error. See server logs.');
          return;
        }
      }

      // Insert ticket metadata (only on first chunk, skip for rest)
      let metadataId;
      if (archivedCount === 0) {
        if (existingMeta) {
          metadataId = existingMeta.id;
          await updateTicketMetadata({
            id: metadataId,
            discord_channel: channel.name || '',
            ticket_title: channel.name || `ticket-${Date.now()}`,
            created_by: message.member?.user.username || message.author?.username || 'UNKNOWN',
            summary,
            tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()),
            sale_id: metadata.sale_id || '',
            staff: metadata.staff || [],
            quoted_revenue: typeof metadata.quoted === 'number' ? metadata.quoted : 0,
            property_name: propertyName || ''
          });
          await channel.send('📌 Updated existing ticket metadata.');
        } else {
          metadataId = await insertTicketMetadata({
            channelId: channel.id,
            discordChannel: channel.name || '',
            ticketTitle: channel.name || `ticket-${Date.now()}`,
            createdBy: message.member?.user.username || message.author?.username || 'UNKNOWN',
            summary,
            tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()),
            saleId: metadata.sale_id || '',
            staff: metadata.staff || [],
            quotedRevenue: typeof metadata.quoted === 'number' ? metadata.quoted : 0,
            propertyName: propertyName || ''
          });
          await channel.send('📌 Inserted new ticket metadata.');
        }
      } else {
        metadataId = existingMeta ? existingMeta.id : null;
      }

      // Archive each message in this chunk (full fidelity, no filtering)
      for (const msg of chunk) {
        await insertTicketMessage({
          metadataId,
          timestamp: new Date(msg.createdTimestamp),
          author: msg.author.username,
          content: msg.content
        });
      }

      // Archive files in this chunk (full fidelity)
      for (const msg of chunk) {
        if (msg.attachments instanceof Map && msg.attachments.size > 0) {
          for (const [, attachment] of msg.attachments) {
            try {
              const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
              const fileBuffer = Buffer.from(response.data);
              await insertTicketFile({
                metadataId,
                filename: attachment.name || attachment.filename || '',
                contentType: attachment.contentType || 'application/octet-stream',
                data: fileBuffer
              });
            } catch (error) {
              await channel.send(`⚠️ Failed to archive media: ${attachment.name} — ${error.message}`);
            }
          }
        }
      }

      archivedCount += CHUNK_SIZE;
      await channel.send(`📦 Archived ${Math.min(archivedCount, totalMessages)}/${totalMessages} messages...`);
    }

    await channel.send('✅ Archive complete.');

    // End: Prompt for closure or leave open
    await channel.send("If you'd like, I can close this ticket for you. Just let me know if that's what you want!");

    // Optional: add a timeout/collector here if you want automated close after archive, else keep simple and foundation-minimal

  } catch (err) {
    try {
      if (message.channel) await message.channel.send(`❌ Archive failed: ${err.message}`);
      else if (message.author) await message.author.send(`❌ Archive failed: ${err.message}`);
    } catch {}
  }
}
