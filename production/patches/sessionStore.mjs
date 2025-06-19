// sessionStore.mjs - Redis session helpers (ESM)
import { createClient } from 'redis';

const client = createClient();
await client.connect();

export async function setSession(key, value) {
  await client.set(`session:${key}`, JSON.stringify(value), { EX: 1800 }); // 30 min expiry
}
export async function getSession(key) {
  const raw = await client.get(`session:${key}`);
  return raw ? JSON.parse(raw) : null;
}
export async function delSession(key) {
  await client.del(`session:${key}`);
}
export async function hasSession(key) {
  return (await client.exists(`session:${key}`)) === 1;
}
