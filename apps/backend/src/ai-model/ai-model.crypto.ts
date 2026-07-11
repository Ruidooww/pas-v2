import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AiModelError } from "./ai-model.errors";
import type { EncryptedSecret } from "./ai-model.types";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;

export function encryptApiKey(apiKey: string, encodedMasterKey: string | undefined): EncryptedSecret {
  const masterKey = decodeMasterKey(encodedMasterKey);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);

  return {
    encryptedApiKey: ciphertext.toString("base64"),
    apiKeyIv: iv.toString("base64"),
    apiKeyAuthTag: cipher.getAuthTag().toString("base64")
  };
}

export function decryptApiKey(secret: EncryptedSecret, encodedMasterKey: string | undefined): string {
  const masterKey = decodeMasterKey(encodedMasterKey);

  try {
    const decipher = createDecipheriv(ALGORITHM, masterKey, Buffer.from(secret.apiKeyIv, "base64"));
    decipher.setAuthTag(Buffer.from(secret.apiKeyAuthTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(secret.encryptedApiKey, "base64")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    throw encryptionUnavailable();
  }
}

function decodeMasterKey(value: string | undefined): Buffer {
  const encoded = value?.trim();
  if (!encoded) {
    throw encryptionUnavailable();
  }

  const decoded = Buffer.from(encoded, "base64");
  if (decoded.length !== KEY_LENGTH_BYTES || decoded.toString("base64") !== encoded) {
    throw encryptionUnavailable();
  }
  return decoded;
}

function encryptionUnavailable(): AiModelError {
  return new AiModelError(
    "MODEL_CONFIG_ENCRYPTION_UNAVAILABLE",
    "AI model configuration encryption is unavailable"
  );
}
