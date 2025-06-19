// 📂 postToThread.mjs
import { AttachmentBuilder } from 'discord.js';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function postArchivedLogToThread(thread, archiveData) {
  const { metadata, messages } = archiveData;
  await thread.send(`📄 Archived log for **${metadata.ticket_title}**:`);

  for (const msg of messages) {
    await thread.send(`**${msg.author}**: ${msg.content}`);
  }

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
}
