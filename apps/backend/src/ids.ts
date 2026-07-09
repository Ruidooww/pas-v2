import crypto from "node:crypto";

export function createPrefixedId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
