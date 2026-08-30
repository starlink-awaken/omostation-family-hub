import { describe, expect, test } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchOverlay } from "./SearchOverlay";

const MOCK_DOCS = [{ path: "doc.md", title: "测试文档", text: "内容", tags: [], id: "1" }];

describe("SearchOverlay", () => {
  test("renders nothing when closed", () => {
    const { container } = render(<SearchOverlay initialDocs={MOCK_DOCS} />);
    expect(container.innerHTML).toBe("");
  });

  test("renders search input after Cmd+K", () => {
    render(<SearchOverlay initialDocs={MOCK_DOCS} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByPlaceholderText(/搜索/)).toBeInTheDocument();
  });
});
