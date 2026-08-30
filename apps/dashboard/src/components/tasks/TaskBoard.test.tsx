import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TaskBoard } from "./TaskBoard";

const MOCK_GROUPS = {
  groups: [
    { domain: "测试", pending: [{ id: "t1", text: "完成优化", sourcePath: "doc.md", domain: "测试" }], done: [] },
  ],
  stats: { pending: 1, completed: 0 },
};

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(MOCK_GROUPS) });
});

describe("TaskBoard", () => {
  test("renders task count after loading", async () => {
    render(<TaskBoard />);
    await waitFor(() => expect(screen.getByText(/待处理 1/)).toBeInTheDocument());
  });

  test("renders task text", async () => {
    render(<TaskBoard />);
    await waitFor(() => expect(screen.getByText("完成优化")).toBeInTheDocument());
  });
});
