//pinecone client
import * as dotenv from "dotenv";
dotenv.config();

let pinecone;
let pineconeIndex;

// Check if Pinecone is enabled in environment
async function initPinecone() {
  if (process.env.PINECONE_ENABLED === 'true') {
    const { Pinecone } = await import("@pinecone-database/pinecone");
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT,
    });
    pineconeIndex = pinecone.index(process.env.PINECONE_INDEX_NAME);
    console.log('🟢 Pinecone index loaded');
  } else {
    console.warn('🟡 Pinecone is disabled. Using stub.');
    pineconeIndex = {
      upsert: async () => console.log('🟡 Stub: pineconeIndex.upsert()'),
      query: async () => ({ matches: [] }),
    };
  }
}

await initPinecone();

export { pineconeIndex };
export async function upsertToPinecone(id, values, metadata = {}) {
  return await pineconeIndex.upsert([
    {
      id,
      values,
      metadata
    }
  ]);
}
export async function semanticSearch(vector, topK = 5) {
  const result = await pineconeIndex.query({
    vector,
    topK,
    includeMetadata: true
  });
  return result.matches || [];
}
