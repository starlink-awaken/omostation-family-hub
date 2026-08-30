export type Sensitivity = "public" | "private" | "sensitive";

export type DataMeta = {
  schemaVersion: string;
  generatedAt: string;
  sources: string[];
};

export type Link = {
  title: string;
  href: string;
};

export type Item = {
  id: string;
  title: string;
  summary?: string;
  status?: string;
  tags?: string[];
  sourcePath?: string;
  sourceTitle?: string;
  updatedAt?: string;
  sensitivity?: Sensitivity;
};
