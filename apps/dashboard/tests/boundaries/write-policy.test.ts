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

test("file save requires CSRF while legacy backup remains disabled", async () => {
  const saveResponse = await saveFile(new Request("http://localhost/api/file/save", { method: "POST" }));
  const backupResponse = await backupDocuments(new Request("http://localhost/api/cron/ssot-backup"));

  expect(saveResponse.status).toBe(403);
  expect(backupResponse.status).toBe(403);
  await expect(saveResponse.json()).resolves.toEqual({ error: "缺少 CSRF 校验" });
  await expect(backupResponse.json()).resolves.toMatchObject({ code: "DOCUMENTS_WRITE_DISABLED" });
});

test("domain writers reject before reading Documents", async () => {
  await expect(updateVaccineStatus("name", "dose", "2026-01-01")).rejects.toBeInstanceOf(
    DocumentsWriteDisabledError,
  );
  await expect(markMilestoneAchieved("title", "2026-01-01")).rejects.toBeInstanceOf(
    DocumentsWriteDisabledError,
  );
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
