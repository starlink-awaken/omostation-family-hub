import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

import { statePath, stateRoot } from "@/lib/paths";
import { canWriteSsotPath, resolveSsotPath } from "@/lib/ssot";

export type HitlOperation = "replace_text" | "vaccine_update" | "milestone_achieve";
export type PendingWrite = { status: "pending"; proposalId: string };
export type StageInput = {
  operation: HitlOperation;
  targetRelative: string;
  content: string;
  summary: string;
};

function sha256(value: Uint8Array | string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

async function sourceState(target: string) {
  try {
    const [content, metadata] = await Promise.all([readFile(target), stat(target)]);
    if (!metadata.isFile()) throw new Error("Documents target must be a regular file");
    return {
      exists: true,
      sha256: sha256(content),
      mode: `0o${(metadata.mode & 0o7777).toString(8)}`,
      bytes: content.length,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { exists: false, sha256: sha256(new Uint8Array()), mode: "0o600", bytes: 0 };
    }
    throw error;
  }
}

export async function stageHitlProposal(
  input: StageInput,
): Promise<{ proposal: Record<string, unknown>; payloadPath: string }> {
  if (!canWriteSsotPath(input.targetRelative)) throw new Error("Documents target is not allowed");
  const target = resolveSsotPath(input.targetRelative);
  if (!target) throw new Error("Documents target is unsafe");
  const bytes = Buffer.from(input.content, "utf8");
  if (!bytes.length || bytes.length > 2_000_000) throw new Error("proposal payload is invalid");
  const current = await sourceState(target);
  const proposalId = `family-write-${randomUUID()}`;
  const payloadPath = statePath("proposals", proposalId, "payload");
  await mkdir(path.dirname(payloadPath), { recursive: true, mode: 0o700 });
  const handle = await open(payloadPath, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  const base = {
    id: proposalId,
    type: "family_dashboard_document_write",
    debt_id: "family-dashboard-content",
    source: "family-dashboard",
    target: `documents://family/${input.targetRelative}`,
    expected_change: input.summary,
    operation_level: "L3",
    approval_required: true,
    rollback: "restore exact source bytes or absence",
    verification: "verify runtime receipt digest",
    auto_apply: "disabled",
    operation: input.operation,
    target_relative: input.targetRelative,
    expected_source_exists: current.exists,
    expected_source_sha256: current.sha256,
    expected_source_mode: current.mode,
    expected_source_bytes: current.bytes,
    payload_ref: path.relative(stateRoot(), payloadPath).split(path.sep).join("/"),
    payload_sha256: sha256(bytes),
    payload_bytes: bytes.length,
  };
  return {
    proposal: { ...base, proposal_digest: sha256(JSON.stringify(canonical(base))) },
    payloadPath,
  };
}

export async function submitHitlProposal(staged: {
  proposal: Record<string, unknown>;
  payloadPath: string;
}): Promise<PendingWrite> {
  const cockpit = process.env.COCKPIT_INTERNAL_URL?.replace(/\/$/u, "");
  const key = process.env.FAMILY_HITL_COCKPIT_API_KEY;
  if (!cockpit || !key) {
    await rm(path.dirname(staged.payloadPath), { recursive: true, force: true });
    throw new Error("Cockpit HITL ingress is unavailable");
  }
  try {
    const response = await fetch(`${cockpit}/api/v1/proposals`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify(staged.proposal),
      signal: AbortSignal.timeout(5_000),
    });
    const result = (await response.json()) as { status?: string; proposal_id?: string };
    const proposalId = typeof staged.proposal.id === "string" ? staged.proposal.id : "";
    if (response.status !== 202 || result.status !== "pending" || result.proposal_id !== proposalId) {
      throw new Error("Cockpit rejected HITL proposal");
    }
    return { status: "pending", proposalId };
  } catch (error) {
    await rm(path.dirname(staged.payloadPath), { recursive: true, force: true });
    throw error;
  }
}
