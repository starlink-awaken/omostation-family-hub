import type { DomainData } from "@/types/domain";
import type { SummaryData } from "@/types/summary";

export function assertSummarySchema(data: SummaryData): void {
  if (!data.meta?.schemaVersion) {
    throw new Error("summary.meta.schemaVersion missing");
  }

  if (!data.meta?.generatedAt) {
    throw new Error("summary.meta.generatedAt missing");
  }

  if (!Array.isArray(data.meta.sources)) {
    throw new Error("summary.meta.sources must be array");
  }

  if (!data.overview) {
    throw new Error("summary.overview missing");
  }

  if (!Array.isArray(data.weekFocus)) {
    throw new Error("summary.weekFocus must be array");
  }

  if (!data.entries) {
    throw new Error("summary.entries missing");
  }

  if (!Array.isArray(data.entries.secondary)) {
    throw new Error("summary.entries.secondary must be array");
  }

  if (!Array.isArray(data.recentUpdates)) {
    throw new Error("summary.recentUpdates must be array");
  }

  if (!Array.isArray(data.signals)) {
    throw new Error("summary.signals must be array");
  }
}

export function assertDomainSchema(data: DomainData): void {
  if (!data.meta?.schemaVersion) {
    throw new Error("domain.meta.schemaVersion missing");
  }

  if (!data.meta?.generatedAt) {
    throw new Error("domain.meta.generatedAt missing");
  }

  if (!Array.isArray(data.meta.sources)) {
    throw new Error("domain.meta.sources must be array");
  }

  if (!data.overview?.title) {
    throw new Error("domain.overview.title missing");
  }

  if (typeof data.overview.totalCount !== "number") {
    throw new Error("domain.overview.totalCount must be number");
  }

  if (typeof data.overview.sourceCount !== "number") {
    throw new Error("domain.overview.sourceCount must be number");
  }

  if (!Array.isArray(data.items)) {
    throw new Error("domain.items must be array");
  }

  if (!Array.isArray(data.focus)) {
    throw new Error("domain.focus must be array");
  }

  if (!Array.isArray(data.nextActions)) {
    throw new Error("domain.nextActions must be array");
  }

  if (!Array.isArray(data.links)) {
    throw new Error("domain.links must be array");
  }

  if (!data.updatedAt) {
    throw new Error("domain.updatedAt missing");
  }
}
