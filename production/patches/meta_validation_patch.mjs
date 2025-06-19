// meta_validation_patch.mjs
// Patch script for inserting validateMetadataSchema logic in archiveHandler.mjs
import { promises as fs } from 'fs';

const [,, targetFile] = process.argv;

let src = await fs.readFile(targetFile, 'utf8');
let out = src;

// 1. Insert import if missing
if (!out.includes("import { validateMetadataSchema } from './assistantsClient.mjs';")) {
  out = "import { validateMetadataSchema } from './assistantsClient.mjs';\n" + out;
  console.log('Inserted validateMetadataSchema import');
}

// 2. Insert validation block after metadata extraction
const metaExtractMarker = 'const metadata = await extractMetadataFromMessages(messageLog);';
if (out.includes(metaExtractMarker) && !out.includes('const validation = validateMetadataSchema(metadata);')) {
  const validationBlock = `\nconst validation = validateMetadataSchema(metadata);\nif (!validation.valid) {\n  console.error('Metadata validation failed:', validation.issues);\n  await message.channel.send('❌ Archive aborted due to metadata error.');\n  return;\n}\n`;
  out = out.replace(metaExtractMarker, metaExtractMarker + validationBlock);
  console.log('Inserted metadata validation block after metadata extraction.');
}

await fs.writeFile(targetFile, out, 'utf8');
console.log('Patch applied successfully.');
