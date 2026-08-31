import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, expect, test, vi } from "vitest";

import {
  DocumentsWriteDisabledError,
  assertDocumentsWriteDisabled,
  documentsWriteDisabledResponse,
} from "@/lib/write-policy";
import { POST as saveFile } from "@/app/api/file/save/route";
import { GET as backupDocuments } from "@/app/api/cron/ssot-backup/route";
import { markMilestoneAchieved, updateVaccineStatus } from "@/lib/ssot-writer";
import { createDocumentsSnapshotReceipt } from "@/lib/state-snapshot";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test("Documents write policy is unconditionally disabled in Phase A", async () => {
  expect(() => assertDocumentsWriteDisabled()).toThrow(DocumentsWriteDisabledError);
  const response = documentsWriteDisabledResponse();
  expect(response.status).toBe(403);
  await expect(response.json()).resolves.toEqual({
    code: "DOCUMENTS_WRITE_DISABLED",
    error: "Documents writes require OMO proposal and approval",
  });
});

test("file save stages private payload and returns pending proposal", async () => {
  const documentsRoot = await mkdtemp(path.join(os.tmpdir(), "family-documents-"));
  const stateRoot = await mkdtemp(path.join(os.tmpdir(), "family-state-"));
  const target = path.join(documentsRoot, "_knowledge", "note.md");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, "old\n");
  vi.stubEnv("FAMILY_DOCUMENTS_ROOT", documentsRoot);
  vi.stubEnv("FAMILY_DASHBOARD_STATE_ROOT", stateRoot);
  vi.stubEnv("COCKPIT_INTERNAL_URL", "http://cockpit.internal");
  vi.stubEnv("FAMILY_HITL_COCKPIT_API_KEY", "test-key");
  vi.stubEnv("FAMILY_CSRF_TOKEN", "csrf");
  let submitted: Record<string, unknown> | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => {
      submitted = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ status: "pending", proposal_id: submitted.id }), { status: 202 });
    }),
  );

  const response = await saveFile(
    new Request("http://localhost/api/file/save", {
      method: "POST",
      headers: { "content-type": "application/json", "x-family-dashboard-csrf": "csrf" },
      body: JSON.stringify({ path: "_knowledge/note.md", content: "new\n" }),
    }),
  );
  expect(response.status).toBe(202);
  await expect(response.json()).resolves.toMatchObject({
    status: "pending",
    code: "DOCUMENTS_WRITE_PENDING_APPROVAL",
  });
  expect(String(submitted?.id)).toMatch(/^family-write-/u);
  expect(submitted).not.toHaveProperty("content");
  expect(await readFile(target, "utf8")).toBe("old\n");
});

test("Cockpit rejection removes newly staged payload and preserves Documents", async () => {
  const documentsRoot = await mkdtemp(path.join(os.tmpdir(), "family-documents-"));
  const stateRoot = await mkdtemp(path.join(os.tmpdir(), "family-state-"));
  const target = path.join(documentsRoot, "_knowledge", "note.md");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, "old\n");
  vi.stubEnv("FAMILY_DOCUMENTS_ROOT", documentsRoot);
  vi.stubEnv("FAMILY_DASHBOARD_STATE_ROOT", stateRoot);
  vi.stubEnv("COCKPIT_INTERNAL_URL", "http://cockpit.internal");
  vi.stubEnv("FAMILY_HITL_COCKPIT_API_KEY", "test-key");
  vi.stubEnv("FAMILY_CSRF_TOKEN", "csrf");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ status: "error" }), { status: 503 })),
  );

  const response = await saveFile(
    new Request("http://localhost/api/file/save", {
      method: "POST",
      headers: { "content-type": "application/json", "x-family-dashboard-csrf": "csrf" },
      body: JSON.stringify({ path: "_knowledge/note.md", content: "new\n" }),
    }),
  );
  expect(response.status).toBe(409);
  expect(await readdir(path.join(stateRoot, "proposals"))).toEqual([]);
  expect(await readFile(target, "utf8")).toBe("old\n");
});

test("file save requires CSRF while snapshot route requires cron auth", async () => {
  const saveResponse = await saveFile(new Request("http://localhost/api/file/save", { method: "POST" }));
  const backupResponse = await backupDocuments(new Request("http://localhost/api/cron/ssot-backup"));

  expect(saveResponse.status).toBe(403);
  expect(backupResponse.status).toBe(401);
  await expect(saveResponse.json()).resolves.toEqual({ error: "缺少 CSRF 校验" });
  await expect(backupResponse.json()).resolves.toEqual({ error: "unauthorized" });
});

test("domain proposal writers require explicit target bindings before reading Documents", async () => {
  await expect(updateVaccineStatus("name", "dose", "2026-01-01")).rejects.toThrow(
    "FAMILY_VACCINE_DOCUMENT_RELATIVE is required",
  );
  await expect(markMilestoneAchieved("title", "2026-01-01")).rejects.toThrow(
    "FAMILY_MILESTONE_DOCUMENT_RELATIVE is required",
  );
});

test("vaccine update creates a proposal from an explicit private target binding", async () => {
  const documentsRoot = await mkdtemp(path.join(os.tmpdir(), "family-documents-"));
  const stateRoot = await mkdtemp(path.join(os.tmpdir(), "family-state-"));
  const relative = "_knowledge/health/vaccines.md";
  const target = path.join(documentsRoot, relative);
  await mkdir(path.dirname(target), { recursive: true });
  const original = "| 月龄 | 疫苗 | 剂次 | 日期 | 实际 | 状态 | 备注 |\n| 1 | A | 1 | x |  | ⏳ | |\n";
  await writeFile(target, original);
  vi.stubEnv("FAMILY_DOCUMENTS_ROOT", documentsRoot);
  vi.stubEnv("FAMILY_DASHBOARD_STATE_ROOT", stateRoot);
  vi.stubEnv("FAMILY_VACCINE_DOCUMENT_RELATIVE", relative);
  vi.stubEnv("COCKPIT_INTERNAL_URL", "http://cockpit.internal");
  vi.stubEnv("FAMILY_HITL_COCKPIT_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => {
      const proposal = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ status: "pending", proposal_id: proposal.id }), { status: 202 });
    }),
  );
  const result = await updateVaccineStatus("A", "1", "2026-08-30");
  expect(result.status).toBe("pending");
  expect(await readFile(target, "utf8")).toBe(original);
});

test("snapshot writes only an aggregate Workspace-state receipt", async () => {
  const documentsRoot = await mkdtemp(path.join(os.tmpdir(), "family-documents-"));
  const stateRoot = await mkdtemp(path.join(os.tmpdir(), "family-state-"));
  await writeFile(path.join(documentsRoot, "note.md"), "private body\n");
  vi.stubEnv("FAMILY_DOCUMENTS_ROOT", documentsRoot);
  vi.stubEnv("FAMILY_DASHBOARD_STATE_ROOT", stateRoot);
  const receipt = await createDocumentsSnapshotReceipt();
  const serialized = JSON.stringify(receipt);
  expect(receipt).toMatchObject({
    schema: "family-documents-snapshot/v1",
    fileCount: 1,
    writesDocuments: false,
  });
  expect(serialized).not.toContain("private body");
  expect(serialized).not.toContain(documentsRoot);
  vi.stubEnv("FAMILY_CRON_TOKEN", "cron-secret");
  const response = await backupDocuments(
    new Request("http://localhost/api/cron/ssot-backup?cron_token=cron-secret"),
  );
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    schema: "family-documents-snapshot/v1",
    writesDocuments: false,
  });
});

test("task mutation writes only below the explicit state root", async () => {
  const documentsRoot = await mkdtemp(path.join(os.tmpdir(), "family-documents-"));
  const stateRoot = await mkdtemp(path.join(os.tmpdir(), "family-state-"));
  const generated = path.join(stateRoot, "generated");
  await mkdir(generated);
  await writeFile(
    path.join(generated, "tasks.json"),
    JSON.stringify([
      {
        id: "task-1",
        text: "Synthetic task",
        done: false,
        sourcePath: "_knowledge/task.md",
        sourceTitle: "Tasks",
        domain: "daily",
      },
    ]),
  );
  vi.stubEnv("FAMILY_DOCUMENTS_ROOT", documentsRoot);
  vi.stubEnv("FAMILY_DASHBOARD_STATE_ROOT", stateRoot);
  const { POST } = await import("@/app/api/tasks/route");

  const response = await POST(
    new Request("http://localhost/api/tasks", {
      method: "POST",
      body: JSON.stringify({ taskId: "task-1", done: true }),
    }),
  );

  expect(response.status).toBe(200);
  const tasks = JSON.parse(await readFile(path.join(generated, "tasks.json"), "utf8"));
  expect(tasks[0].done).toBe(true);
  await expect(readFile(path.join(documentsRoot, "tasks.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
});

test("legacy shell backup cannot mutate Documents", async () => {
  const script = await readFile(path.join(process.cwd(), "scripts", "ssot-git-backup.sh"), "utf8");

  expect(script).toContain("DOCUMENTS_WRITE_DISABLED");
  expect(script).toContain("exit 78");
  expect(script).not.toMatch(/git\s+(add|commit)/u);
});
