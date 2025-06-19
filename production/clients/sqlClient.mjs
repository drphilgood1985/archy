// sqlClient.mjs
import pg from 'pg';
import dotenv from 'dotenv';
import * as validator from './validator.mjs';
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ---- Allowed MIME types for files ----
const ALLOWED_FILE_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'application/pdf',
  'image/webp', 'video/mp4', 'video/quicktime', // add as needed
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// TICKET METADATA FUNCTIONS

export async function insertTicketMetadata({
  channelId,
  discordChannel,
  ticketTitle,
  createdBy,
  summary,
  tags,
  saleId,
  staff,
  quotedRevenue,
  propertyName,
}) {
  try {
    if (!channelId || !discordChannel || !ticketTitle || !createdBy) throw new Error('Missing metadata required fields.');
    const res = await pool.query(
      `INSERT INTO ticket_metadata 
        (channel_id, discord_channel, ticket_title, created_by, summary, tags, sale_id, staff, quoted_revenue, property_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [channelId, discordChannel, ticketTitle, createdBy, summary, tags, saleId, staff, quotedRevenue, propertyName]
    );
    return res.rows[0].id;
  } catch (err) {
    console.error('insertTicketMetadata error:', err);
    throw err;
  }
}

export async function updateTicketMetadata({
  id,
  discord_channel,
  ticket_title,
  created_by,
  summary,
  tags,
  sale_id,
  staff,
  quoted_revenue,
  property_name,
}) {
  try {
    await pool.query(
      `UPDATE ticket_metadata SET
         discord_channel = $1,
         ticket_title = $2,
         created_by = $3,
         summary = $4,
         tags = $5,
         sale_id = $6,
         staff = $7,
         quoted_revenue = $8,
         property_name = $9
       WHERE id = $10`,
      [discord_channel, ticket_title, created_by, summary, tags, sale_id, staff, quoted_revenue, property_name, id]
    );
  } catch (err) {
    console.error('updateTicketMetadata error:', err);
    throw err;
  }
}

// TICKET MESSAGES

export async function insertTicketMessage({ metadataId, timestamp, author, content }) {
  try {
    if (!metadataId || !timestamp || !author || !content) throw new Error('Missing ticket message fields.');
    if (!validator.isValidTextMessage({ author, content })) throw new Error('Rejected: Not a valid text message for DB.');
    await pool.query(
      `INSERT INTO ticket_messages (metadata_id, author, content, "timestamp")
       VALUES ($1, $2, $3, $4)`,
      [metadataId, author, content, timestamp]
    );
  } catch (err) {
    console.error('insertTicketMessage error:', err);
    throw err;
  }
}

export async function fetchTicketMessages(metadataId) {
  try {
    const res = await pool.query(
      `SELECT author, content, "timestamp"
       FROM ticket_messages
       WHERE metadata_id = $1
       ORDER BY "timestamp" ASC`,
      [metadataId]
    );
    // Only return text-valid entries
    return res.rows.filter(msg => validator.isValidTextMessage(msg));
  } catch (err) {
    console.error('fetchTicketMessages error:', err);
    return [];
  }
}

// TICKET FILES

export async function insertTicketFile({ metadataId, filename, contentType, data }) {
  try {
    if (!metadataId || !filename || !contentType || !data) throw new Error('Missing file fields.');
    if (!Buffer.isBuffer(data)) throw new Error('File data is not a Buffer.');
    if (!ALLOWED_FILE_TYPES.includes(contentType)) throw new Error('File type not allowed: ' + contentType);
    await pool.query(
      `INSERT INTO ticket_files (metadata_id, filename, content_type, data)
       VALUES ($1, $2, $3, $4)`,
      [metadataId, filename, contentType, data]
    );
  } catch (err) {
    console.error('insertTicketFile error:', err);
    throw err;
  }
}

// SESSION MANAGEMENT (unchanged)

export async function setSession(userId, sessionData) {
  const json = JSON.stringify(sessionData);
  await pool.query(
    `INSERT INTO search_sessions (user_id, session_data, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET session_data = $2, updated_at = NOW()`,
    [userId, json]
  );
}

export async function getSession(userId) {
  const res = await pool.query(
    `SELECT session_data FROM search_sessions WHERE user_id = $1`,
    [userId]
  );
  if (res.rows.length === 0) return null;
  try {
    return JSON.parse(res.rows[0].session_data);
  } catch {
    return null;
  }
}

export async function delSession(userId) {
  await pool.query(`DELETE FROM search_sessions WHERE user_id = $1`, [userId]);
}

export async function hasSession(userId) {
  const res = await pool.query(
    `SELECT 1 FROM search_sessions WHERE user_id = $1`,
    [userId]
  );
  return res.rows.length > 0;
}

// USER MEMORY LOGS (REM ROM)

export async function getUserMemoryLog(userId) {
  const res = await pool.query(
    `SELECT log FROM user_memory_logs WHERE user_id = $1`,
    [userId]
  );
  if (res.rows.length === 0) {
    // Create new log if none exists
    await pool.query(
      `INSERT INTO user_memory_logs (user_id, log, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
      [userId, JSON.stringify([])]
    );
    return [];
  }
  return res.rows[0].log || [];
}

export async function appendUserMemoryLog(userId, entry) {
  // Get current log or create one
  const res = await pool.query(
    `SELECT log FROM user_memory_logs WHERE user_id = $1`,
    [userId]
  );
  let newLog = [];
  if (res.rows.length > 0 && Array.isArray(res.rows[0].log)) {
    newLog = res.rows[0].log;
  }
  newLog.push({ entry, timestamp: new Date().toISOString() });

  // Upsert new log
  await pool.query(
    `INSERT INTO user_memory_logs (user_id, log, entry, created_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id) DO UPDATE SET log = $2, entry = $3, created_at = NOW()`,
    [userId, JSON.stringify(newLog), entry]
  );
}

// TICKET METADATA FETCH BY ID OR CHANNEL

export async function fetchTicketMetadataByChannelId(channelId) {
  const res = await pool.query(
    `SELECT * FROM ticket_metadata WHERE channel_id = $1`,
    [channelId]
  );
  return res.rows[0];
}

export async function fetchTicketMetadata(ticketId) {
  const res = await pool.query(
    `SELECT * FROM ticket_metadata WHERE id = $1`,
    [ticketId]
  );
  return res.rows[0];
}

// KEYWORD SEARCH

export async function searchTicketsByKeywords(keywords) {
  const query = keywords.join(' & ');
  const res = await pool.query(
    `SELECT id, summary, tags, channel_id, property_name, created_at
     FROM ticket_metadata
     WHERE to_tsvector('english', coalesce(property_name, '') || ' ' || coalesce(summary, '') || ' ' || array_to_string(tags, ' '))
     @@ to_tsquery('english', $1)
     ORDER BY id DESC
     LIMIT 5`,
    [query]
  );
  return res.rows;
}

export async function queryTicketByKeywords(query) {
  return await searchTicketsByKeywords(query.split(/\s+/));
}
