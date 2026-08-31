/**
 * Proposal approve route — triggers Cockpit HITL execution.
 *
 * Per T10-122 spec, approval invokes the Agora BOS route
 * bos://governance/hitl/execute/family_dashboard_document_write
 * which routes to the family-hub CAS transaction owner.
 */

import { NextResponse } from "next/server";
import { statePath } from "@/lib/paths";
import { readFile } from "node:fs/promises";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proposalId } = await params;
  try {

    // Load proposal
    let proposal: Record<string, unknown>;
    try {
      const raw = await readFile(statePath("proposals", `${proposalId}.json`), "utf8");
      proposal = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "提案未找到" }, { status: 404 });
    }

    // Verify proposal is pending
    if (proposal.status !== "pending") {
      return NextResponse.json(
        { error: `提案状态 '${proposal.status}' 不可审批` },
        { status: 409 }
      );
    }

    // In Phase B, the actual BOS invocation goes through Cockpit API
    // Dashboard delegates to Cockpit via internal API call
    const cockpitUrl = process.env.COCKPIT_API_URL || "http://localhost:3001";
    const approvalResponse = await fetch(`${cockpitUrl}/api/v1/proposals/${proposalId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proposal_id: proposalId,
        action: "approve",
        source: "dashboard",
      }),
    });

    if (!approvalResponse.ok) {
      const errBody = await approvalResponse.text();
      return NextResponse.json(
        { error: "审批执行失败", detail: errBody },
        { status: 502 }
      );
    }

    // Update proposal status
    const updatedProposal = {
      ...proposal,
      status: "approved",
      approved_at: new Date().toISOString(),
    };
    await (
      await import("node:fs/promises")
    ).writeFile(
      statePath("proposals", `${proposalId}.json`),
      JSON.stringify(updatedProposal, null, 2)
    );

    return NextResponse.json({
      proposal_id: proposalId,
      status: "approved",
      message: "提案已审批并提交执行",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "审批失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
