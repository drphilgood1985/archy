export async function handleRestoreCommand(message, ticketId) {
  try {
    // PATCH: Block thread restore in DMs, suggest summary or ad hoc instead
    if (message.channel.type === 1 || message.guild == null) {
      await message.channel.send("❌ Log restore is only available in server channels, not in direct messages. Try !summary or use ad hoc search here.");
      return;
    }

    // Fetch metadata and messages
    const metadata = await fetchTicketMetadata(ticketId);
    if (!metadata) {
      await message.channel.send(`❌ No ticket found with ID ${ticketId}`);
      return;
    }
    const messages = await fetchTicketMessages(ticketId);
    if (!messages?.length) {
      await message.channel.send('❌ No messages found in this ticket.');
      return;
    }

    // Generate a summary for the restored thread (optional)
    const summary = await runAssistantForSummary(messages);

    // Start a new thread in the channel
    const thread = await message.startThread({ name: `Restored: ${metadata.ticket_title || metadata.property_name || 'ticket'}` });
    await thread.send(`📄 Restored ticket log for **${metadata.ticket_title || metadata.property_name || 'ticket'}**:\n${summary}`);

    // Send each archived message
    for (const msg of messages) {
      await thread.send(`**${msg.author}**: ${msg.content}`);
    }

    // Fetch and send attachments
    const files = await pool.query(
      'SELECT filename, content_type, data FROM ticket_files WHERE ticket_id = $1',
      [metadata.id]
    );

    for (const file of files.rows) {
      const buffer = Buffer.from(file.data);
      const attachment = new AttachmentBuilder(buffer, {
        name: file.filename,
        contentType: file.content_type
      });
      await thread.send({ files: [attachment] });
    }

    await thread.send('✅ Log restore complete.');
  } catch (err) {
    await message.channel.send(`❌ Restore failed: ${err.message}`);
  }
}
