/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MarkdownRenderer } from "./MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("renders nothing for null content", () => {
    const { container } = render(<MarkdownRenderer content={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for undefined content", () => {
    const { container } = render(<MarkdownRenderer content={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for empty string", () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a heading", () => {
    render(<MarkdownRenderer content="# Hello World" />);
    expect(
      screen.getByRole("heading", { name: "Hello World", level: 1 }),
    ).toBeTruthy();
  });

  it("renders bold text", () => {
    render(<MarkdownRenderer content="**bold text**" />);
    const bold = document.querySelector("strong");
    expect(bold).toBeTruthy();
    expect(bold?.textContent).toBe("bold text");
  });

  it("renders italic text", () => {
    render(<MarkdownRenderer content="*italic text*" />);
    const em = document.querySelector("em");
    expect(em).toBeTruthy();
    expect(em?.textContent).toBe("italic text");
  });

  it("renders a link with target=_blank and rel=noopener noreferrer", () => {
    render(<MarkdownRenderer content="[visit](https://example.com)" />);
    const link = screen.getByRole("link", { name: "visit" });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders a code block with a language class", () => {
    render(<MarkdownRenderer content={'```python\nprint("hello")\n```'} />);
    // SyntaxHighlighter wraps in a div; verify code is present
    expect(document.body.textContent).toContain('print("hello")');
  });

  it("renders inline code", () => {
    render(<MarkdownRenderer content="Use `npm install` to set up." />);
    const code = document.querySelector("code");
    expect(code).toBeTruthy();
    expect(code?.textContent).toBe("npm install");
  });

  it("renders an unordered list", () => {
    render(
      <MarkdownRenderer
        content={`- item one
- item two`}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe("item one");
    expect(items[1].textContent).toBe("item two");
  });

  it("renders an ordered list", () => {
    render(
      <MarkdownRenderer
        content={`1. first
2. second`}
      />,
    );
    expect(screen.getAllByRole("listitem").length).toBe(2);
  });

  it("renders a blockquote", () => {
    render(<MarkdownRenderer content="> quoted text" />);
    const bq = document.querySelector("blockquote");
    expect(bq).toBeTruthy();
    expect(bq?.textContent?.trim()).toBe("quoted text");
  });

  it("renders GFM pipe tables", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    const { container } = render(<MarkdownRenderer content={md} />);
    const table = container.querySelector("table");
    expect(table).toBeTruthy();
    expect(table?.textContent).toContain("1");
    expect(table?.textContent).toContain("2");
  });

  it("renders GFM task list items with checkboxes", () => {
    render(
      <MarkdownRenderer
        content={`- [x] Done\n- [ ] Todo`}
      />,
    );
    const boxes = document.querySelectorAll('input[type="checkbox"]');
    expect(boxes.length).toBe(2);
    expect((boxes[0] as HTMLInputElement).checked).toBe(true);
    expect((boxes[1] as HTMLInputElement).checked).toBe(false);
  });

  it("maps ```ts to TypeScript highlighting", () => {
    render(
      <MarkdownRenderer
        content={"```ts\nconst x: number = 1;\n```"}
      />,
    );
    expect(document.body.textContent).toContain("const x: number = 1;");
  });

  it("renders Solidity fenced blocks", () => {
    render(
      <MarkdownRenderer
        content={'```solidity\npragma solidity ^0.8.0;\n```'}
      />,
    );
    expect(document.body.textContent).toContain("pragma solidity ^0.8.0;");
  });

  it("strips dangerous javascript: URLs from link hrefs (sanitized)", () => {
    const { container } = render(
      <MarkdownRenderer content="[click me](javascript:alert(1))" />,
    );
    const anchor = container.querySelector("a");
    expect(anchor?.textContent).toBe("click me");
    const href = anchor?.getAttribute("href");
    expect(href === null || !/^javascript:/i.test(href)).toBe(true);
  });

  it("applies custom className to wrapper", () => {
    const { container } = render(
      <MarkdownRenderer content="hello" className="custom-class" />,
    );
    expect(container.firstChild).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).toContain(
      "custom-class",
    );
  });
});
