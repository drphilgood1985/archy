// ticketlist_patch.mjs
// Patch script for safer ticket list fallback & debug logs in searchHandler.mjs
import { promises as fs } from 'fs';

const [,, targetFile] = process.argv;

let src = await fs.readFile(targetFile, 'utf8');
let out = src;

// Replace the ticketList mapping block with fallback for channel id/title and debug logs
const ticketListPattern = /const ticketList = tickets\s*\.map\([^)]*\)\s*\.join\('\\n'\);/;
const replacement = `const ticketList = tickets
  .map((t, i) => {
    const title = t.ticket_title || t.property_name || '(untitled)';
    const channelRef = t.channel_id ? \`<#\${t.channel_id}>\` : '`unknown-channel`';
    return \`**\${i + 1}.** \${title} — \${channelRef}\`;
  })
  .join('\n');
console.log('DEBUG: Tickets returned from search:', tickets);
console.log('DEBUG: Setting session state for user:', message.author.id);`;

if (ticketListPattern.test(out)) {
  out = out.replace(ticketListPattern, replacement);
  console.log('Patched ticketList fallback block and debug logs.');
}

await fs.writeFile(targetFile, out, 'utf8');
console.log('Patch applied successfully.');
