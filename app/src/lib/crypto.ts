import { randomBytes, createCipheriv, createDecipheriv, createHash, timingSafeEqual } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error("ENCRYPTION_KEY environment variable is required")
  // Accept hex (64 chars) or raw (32 chars)
  if (key.length === 64) return Buffer.from(key, "hex")
  if (key.length === 32) return Buffer.from(key, "utf-8")
  throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars or 32 raw chars)")
}

/** Encrypt a plaintext string. Returns "iv:ciphertext:tag" in hex. */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`
}

/** Decrypt a "iv:ciphertext:tag" string back to plaintext. */
export function decrypt(encoded: string): string {
  const key = getEncryptionKey()
  const [ivHex, encryptedHex, tagHex] = encoded.split(":")
  if (!ivHex || !encryptedHex || !tagHex) throw new Error("Invalid encrypted format")

  const iv = Buffer.from(ivHex, "hex")
  const encrypted = Buffer.from(encryptedHex, "hex")
  const tag = Buffer.from(tagHex, "hex")

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final("utf-8")
}

/** Hash a password with bcrypt-like sha256 + salt. For proper production use bcrypt. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex")
  const hash = createHash("sha256").update(salt + password).digest("hex")
  return `${salt}:${hash}`
}

/** Verify a password against a "salt:hash" string. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, expectedHash] = stored.split(":")
  if (!salt || !expectedHash) return false
  const hash = createHash("sha256").update(salt + password).digest("hex")
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expectedHash, "hex"))
}

/** Generate a random session token. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex")
}

/** Hash a session token for storage. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
