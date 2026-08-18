import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

/**
 * Derives a 32-byte key using PBKDF2 from the ENCRYPTION_MASTER_KEY
 */
function getKey(salt: Buffer) {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  if (!masterKey) {
    throw new Error("ENCRYPTION_MASTER_KEY is not defined in environment variables");
  }
  return crypto.pbkdf2Sync(masterKey, salt, 100000, 32, "sha512");
}

export function encryptKey(text: string): { encryptedKey: string; iv: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = getKey(salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // We need to store salt, iv, and tag to decrypt later.
  // We can pack them into the 'iv' field or store them together.
  // Since our schema has 'iv' and 'encryptedKey', we can format 'iv' as 'salt:iv:tag' (hex encoded).
  
  const payloadIv = `${salt.toString("hex")}:${iv.toString("hex")}:${tag.toString("hex")}`;
  
  return {
    encryptedKey: encrypted.toString("hex"),
    iv: payloadIv,
  };
}

export function decryptKey(encryptedHex: string, payloadIv: string): string {
  const parts = payloadIv.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid IV format");
  }

  const salt = Buffer.from(parts[0], "hex");
  const iv = Buffer.from(parts[1], "hex");
  const tag = Buffer.from(parts[2], "hex");
  const key = getKey(salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
