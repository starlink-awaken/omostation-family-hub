import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  test("renders children", () => {
    render(<Card>hello</Card>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  test("renders as custom tag", () => {
    const { container } = render(<Card as="section">section</Card>);
    expect(container.querySelector("section")).toBeInTheDocument();
  });

  test("applies padding classes", () => {
    const { container } = render(<Card padding="lg">content</Card>);
    expect(container.firstChild).toHaveProperty("className", expect.stringContaining("p-5"));
  });
});
