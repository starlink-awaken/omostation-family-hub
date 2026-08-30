export interface FileDoc {
  path: string;
  title: string;
  summary: string;
  tags: string[];
  categories: string[];
  frontmatter: Record<string, unknown>;
  content: string;
}

export interface SearchChunk {
  path: string;
  title: string;
  index: number;
  chunk: string;
  tokenCount: number;
  heading: string;
}

export interface TagIndex {
  tags: Record<string, { count: number; aliases?: string[] }>;
  docs: Record<string, { path: string; title: string; tags: string[] }>;
}

export interface LinkIndex {
  links: Record<string, unknown>;
  backlinks: Record<string, unknown>;
}
