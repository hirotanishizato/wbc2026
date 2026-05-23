import crypto from "node:crypto";
import { config } from "./config.js";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function getKey() {
  const k = Buffer.from(config.encryptionKey, "hex");
  if (k.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars).");
  }
  return k;
}

export function encrypt(plain) {
  if (plain == null || plain === "") return null;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload) {
  if (!payload) return null;
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const data = buf.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
