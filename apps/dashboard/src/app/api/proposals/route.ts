/**
 * Proposal ingress route — creates HITL proposals only.
 *
 * Per T10-122 spec, the Dashboard NEVER writes Documents directly.
 * All write operations must go through: proposal → Cockpit approval →
 * Agora BOS route → family-hub CAS transaction.
 */

import { NextResponse } from "next/server";
import { statePath } from "@/lib/paths";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";

const VALID_OPERATIONS = new Set(["replace_text", "vaccine_update", "milestone_achieve"]);

interface ProposalRequest {
  operation: string;
  target_relative: string;
  expected_source_sha256?: string;
  expected_source_size?: number;
  expected_source_mode?: number;
  payload: Record<string, unknown>;
  change_summary: string;
}

export async function GET() {
  try {
    const proposalsDir = statePath("proposals");
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(proposalsDir).catch(() => []);
    const proposals = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const content = await (await import("node:fs/promises")).readFile(
          statePath("proposals", f),
          "utf8"
        );
        proposals.push(JSON.parse(content));
      } catch {
        // skip unreadable
      }
    }
    return NextResponse.json({ proposals });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "获取提案失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProposalRequest;

    // Validate required fields
    if (!body.operation || !VALID_OPERATIONS.has(body.operation)) {
      return NextResponse.json(
        { error: `无效操作: ${body.operation}。必须是: ${[...VALID_OPERATIONS].join(", ")}` },
        { status: 400 }
      );
    }
    if (!body.target_relative || typeof body.target_relative !== "string") {
      return NextResponse.json({ error: "缺少 target_relative" }, { status: 400 });
    }
    if (!body.change_summary || typeof body.change_summary !== "string") {
      return NextResponse.json({ error: "缺少 change_summary" }, { status: 400 });
    }
    if (!body.payload || typeof body.payload !== "object") {
      return NextResponse.json({ error: "缺少 payload" }, { status: 400 });
    }

    // Path validation: reject traversal and absolute paths
    if (body.target_relative.includes("..") || body.target_relative.startsWith("/")) {
      return NextResponse.json({ error: "路径不能包含 .. 或为绝对路径" }, { status: 400 });
    }

    // Generate proposal ID
    const proposalId = `PROP-FD-${randomUUID().slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    // Compute payload digest
    const payloadBytes = Buffer.from(JSON.stringify(body.payload));
    const { createHash } = await import("node:crypto");
    const payloadSha256 = createHash("sha256").update(payloadBytes).digest("hex");

    // Stage payload to state root (never to Documents)
    const payloadRef = `proposals/${proposalId}/payload.json`;
    const payloadPath = statePath(payloadRef);
    await mkdir(statePath("proposals", proposalId), { recursive: true });
    await writeFile(payloadPath, JSON.stringify(body.payload, null, 2));

    // Build proposal document
    const proposal = {
      proposal_id: proposalId,
      type: "family_dashboard_document_write",
      operation: body.operation,
      target_relative: body.target_relative,
      expected_source_sha256: body.expected_source_sha256 || null,
      expected_source_size: body.expected_source_size ?? 0,
      expected_source_mode: body.expected_source_mode ?? 0o644,
      payload_ref: payloadRef,
      payload_sha256: payloadSha256,
      change_summary: body.change_summary,
      risk_level: "L3",
      approval_required: true,
      auto_apply: false,
      status: "pending",
      created_at: now,
      idempotency_key: "",
    };

    // Write proposal to state root
    await writeFile(
      statePath("proposals", `${proposalId}.json`),
      JSON.stringify(proposal, null, 2)
    );

    // Return 202 Accepted (proposal created, awaiting approval)
    return NextResponse.json(
      {
        proposal_id: proposalId,
        status: "pending",
        message: "提案已创建，等待人工审批",
        proposal,
      },
      { status: 202 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "创建提案失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
