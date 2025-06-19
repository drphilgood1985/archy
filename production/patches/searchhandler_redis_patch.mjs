// searchhandler_redis_patch.mjs
// Patch script for converting searchSessions from Map() to Redis-based async helpers with SQL memoryLog injection

import { promises as fs } from 'fs';

const [,, targetFile] = process.argv;

console.log('DEBUG: cwd =', process.cwd());
console.log('DEBUG: targetFile =', targetFile);
console.log('DEBUG: about to open:', targetFile);

try {
  await fs.access(targetFile);
  console.log('DEBUG: file exists? true');
} catch {
  console.log('DEBUG: file exists? false');
}

let src;
try {
  src = await fs.readFile(targetFile, 'utf8');
} catch (err) {
  console.error(`❌ ERROR: Could not open target file: ${targetFile}`);
  console.error(err.message);
  process.exit(1);
}

// Open the file exactly as specified in the argument—no prepending or modification!
let src;
try {
  src = await fs.readFile(targetFile, 'utf8');
console.log('DEBUG: about to open:', targetFile);
console.log('DEBUG: file exists?', await fs.access(targetFile).then(()=>true).catch(()=>false));

} catch (err) {
  console.error(`❌ ERROR: Could not open target file: ${targetFile}`);
  console.error(err.message);
  process.exit(1);
}
let out = src;

// 1. Import session helpers at the top if missing
if (!out.includes("from './sessionStore.mjs';")) {
  out = "import { setSession, getSession, delSession, hasSession } from './sessionStore.mjs';\n" + out;
  console.log('Inserted Redis sessionStore import');
}

// 2. Import getUserMemoryLog if not already present
if (!out.includes("getUserMemoryLog")) {
  out = "import { getUserMemoryLog } from './assistantsClient.mjs';\n" + out;
  console.log('Inserted getUserMemoryLog import');
}

// 3. Remove const searchSessions = new Map();
out = out.replace(/const searchSessions = new Map\(\);/g, '');

// 4. Replace all searchSessions.has(userId) with await hasSession(userId)
out = out.replace(/searchSessions\.has\(([^)]+)\)/g, 'await hasSession($1)');

// 5. Replace all searchSessions.get(userId) with await getSession(userId)
out = out.replace(/searchSessions\.get\(([^)]+)\)/g, 'await getSession($1)');

// 6. Replace all searchSessions.set\(([^,]+),\s*([^)]+)\)/g with await setSession($1, $2)
out = out.replace(/searchSessions\.set\(([^,]+),\s*([^)]+)\)/g, 'await setSession($1, $2)');

// 7. Replace all searchSessions.delete(userId) with await delSession(userId)
out = out.replace(/searchSessions\.delete\(([^)]+)\)/g, 'await delSession($1)');

// 8. Inject SQL memoryLog when session is first created (for new sessions only)
const sessionCreatePattern = /await message\.channel\.send\([\s\S]*?Please describe.*?\);\s*\n*searchSessions\.set\((.*?)\{([\s\S]*?)state: 'awaiting_selection',([\s\S]*?)tickets([\s\S]*?)\}\);/;
const sessionCreateMatch = out.match(sessionCreatePattern);
if (sessionCreateMatch) {
  // Compose the injection block
  const replacement = `await message.channel.send($&\nconst memoryLog = await getUserMemoryLog(message.author.id);\nawait setSession(message.author.id, {\n  state: 'awaiting_selection',\n  tickets,\n  memoryLog\n});`;
  out = out.replace(sessionCreatePattern, replacement);
  console.log('Injected memoryLog fetch and inclusion in new session.');
} else {
  // fallback - try simple session set line
  out = out.replace(
    /searchSessions\.set\(message\.author\.id, \{\s*state: 'awaiting_selection',\s*tickets\s*\}\);/,
    `const memoryLog = await getUserMemoryLog(message.author.id);\nawait setSession(message.author.id, { state: 'awaiting_selection'_
