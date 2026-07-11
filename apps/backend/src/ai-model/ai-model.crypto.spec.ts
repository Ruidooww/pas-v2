import { describe, expect, it } from "vitest";
import { decryptApiKey, encryptApiKey } from "./ai-model.crypto";

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

describe("AI model API-key encryption", () => {
  it("round-trips an API key with AES-256-GCM", () => {
    const encrypted = encryptApiKey("sk-production-secret", ENCRYPTION_KEY);

    expect(encrypted.encryptedApiKey).not.toContain("sk-production-secret");
    expect(decryptApiKey(encrypted, ENCRYPTION_KEY)).toBe("sk-production-secret");
  });

  it("uses a fresh IV for every encryption", () => {
    const first = encryptApiKey("same-secret", ENCRYPTION_KEY);
    const second = encryptApiKey("same-secret", ENCRYPTION_KEY);

    expect(first.apiKeyIv).not.toBe(second.apiKeyIv);
    expect(first.encryptedApiKey).not.toBe(second.encryptedApiKey);
  });

  it.each([undefined, "", Buffer.alloc(31).toString("base64"), "not-base64!"])(
    "rejects a missing or invalid master key",
    (masterKey) => {
      expectErrorCode(() => encryptApiKey("secret", masterKey), "MODEL_CONFIG_ENCRYPTION_UNAVAILABLE");
    }
  );

  it("rejects a different master key", () => {
    const encrypted = encryptApiKey("secret", ENCRYPTION_KEY);
    const differentKey = Buffer.alloc(32, 8).toString("base64");

    expectErrorCode(() => decryptApiKey(encrypted, differentKey), "MODEL_CONFIG_ENCRYPTION_UNAVAILABLE");
  });

  it("rejects tampered ciphertext and authentication tags", () => {
    const encrypted = encryptApiKey("secret", ENCRYPTION_KEY);

    expectErrorCode(
      () => decryptApiKey({ ...encrypted, encryptedApiKey: tamperBase64(encrypted.encryptedApiKey) }, ENCRYPTION_KEY),
      "MODEL_CONFIG_ENCRYPTION_UNAVAILABLE"
    );
    expectErrorCode(
      () => decryptApiKey({ ...encrypted, apiKeyAuthTag: tamperBase64(encrypted.apiKeyAuthTag) }, ENCRYPTION_KEY),
      "MODEL_CONFIG_ENCRYPTION_UNAVAILABLE"
    );
  });
});

function tamperBase64(value: string): string {
  const bytes = Buffer.from(value, "base64");
  bytes[0] = (bytes[0] ?? 0) ^ 1;
  return bytes.toString("base64");
}

function expectErrorCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected action to throw");
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}
