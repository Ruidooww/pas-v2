import type { QaDraftInput, QaDraftProvider } from "./qa.types";

export class LocalQaDraftProvider implements QaDraftProvider {
  async generateDraft(input: QaDraftInput): Promise<string> {
    const evidence = input.chunks
      .slice(0, 3)
      .map((chunk) => chunk.content.trim())
      .filter(Boolean)
      .join("\n");

    return `需人工审核：根据已检索知识块，问题「${input.query}」的参考回答如下。\n${evidence}`;
  }
}
