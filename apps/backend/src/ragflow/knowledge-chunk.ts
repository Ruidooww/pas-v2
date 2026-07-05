export type KnowledgeChunk = {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  score: number;
  source: string;
  page?: number;
  section?: string;
  position?: string;
  location?: string;
  snippet?: string;
};
