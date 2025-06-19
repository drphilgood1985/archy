// logger.mjs
import fs from 'fs';

const LOG_TO_FILE = process.env.LOG_TO_FILE === 'true';
const LOG_FILE = 'errorlog.txt';
const MAX_LOG_SIZE = 500000; // 500 KB

export async function logError(error, context = 'unspecified') {
  const timestamp = new Date().toISOString();
  const message = `\n[${timestamp}] [${context}]\n${error.stack || error.message || error}`;

  console.error(message);

  if (LOG_TO_FILE) {
    try {
      rotateIfTooLarge();
      fs.appendFileSync(LOG_FILE, message + '\n');
    } catch (writeErr) {
      console.error(`[logger] Failed to write to log file:`, writeErr);
    }
  }
}

export async function logInfo(message, context = 'general') {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${context}] ${message}`;

  console.log(entry);

  if (LOG_TO_FILE) {
    try {
      rotateIfTooLarge();
      fs.appendFileSync(LOG_FILE, entry + '\n');
    } catch (writeErr) {
      console.error(`[logger] Failed to write info to log file:`, writeErr);
    }
  }
}

function rotateIfTooLarge() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > MAX_LOG_SIZE) {
        fs.renameSync(LOG_FILE, `${LOG_FILE}.bak`);
      }
    }
  } catch (err) {
    console.error(`[logger] Log rotation error:`, err);
  }
}

export const logStartup = logInfo;
