const DEFAULT_SECRET = "knowledge-graph-sparql-secret";

function getSecret() {
  return process.env.SPARQL_SECRET_KEY || DEFAULT_SECRET;
}

async function deriveKey() {
  const raw = new TextEncoder().encode(getSecret());
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(value: string) {
  return new Uint8Array(Buffer.from(value, "base64"));
}

export async function encryptSecret(value: string) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("enc::")) return text;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey();
  const data = new TextEncoder().encode(text);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return `enc::${toBase64(iv)}::${toBase64(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(value: string) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!text.startsWith("enc::")) return text;
  const parts = text.split("::");
  if (parts.length !== 3) return "";
  const iv = fromBase64(parts[1] || "");
  const payload = fromBase64(parts[2] || "");
  const key = await deriveKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    payload,
  );
  return new TextDecoder().decode(decrypted);
}

export function maskSecret(value: string) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 4) return "*".repeat(text.length);
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
}
