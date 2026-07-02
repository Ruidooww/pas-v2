import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);

export class PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString("hex");
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt:${salt}:${derived.toString("hex")}`;
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const [scheme, salt, expected] = storedHash.split(":");
    if (scheme !== "scrypt" || !salt || !expected) {
      return false;
    }

    const derived = (await scrypt(password, salt, 64)) as Buffer;
    const expectedBuffer = Buffer.from(expected, "hex");
    return expectedBuffer.length === derived.length && crypto.timingSafeEqual(expectedBuffer, derived);
  }
}
