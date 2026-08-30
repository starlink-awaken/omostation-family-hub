import { describe, expect, test } from "vitest";

import { POST } from "./route";

describe("POST /api/rebuild", () => {
  test("rejects requests without the family CSRF header before running a rebuild", async () => {
    const response = await POST(new Request("http://localhost/api/rebuild", { method: "POST" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "缺少 CSRF 校验" });
  });
});
