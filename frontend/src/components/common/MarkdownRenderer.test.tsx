/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer';

describe('MarkdownRenderer', () => {
  // ── null / empty ────────────────────────────────────────────────────────────
  it('renders nothing for null content', () => {
    const { container } = render(<MarkdownRenderer content={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for undefined content', () => {
    const { container } = render(<MarkdownRenderer content={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for empty string', () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container.firstChild).toBeNull();
  });

  // ── basic markdown ───────────────────────────────────────────────────────────
  it('renders a heading', () => {
    render(<MarkdownRenderer content="# Hello World" />);
    expect(screen.getByRole('heading', { name: 'Hello World', level: 1 })).toBeTruthy();
  });

  it('renders bold text', () => {
    render(<MarkdownRenderer content="**bold text**" />);
    const bold = document.querySelector('strong');
    expect(bold).toBeTruthy();
    expect(bold?.textContent).toBe('bold text');
  });

  it('renders italic text', () => {
    render(<MarkdownRenderer content="*italic text*" />);
    const em = document.querySelector('em');
    expect(em).toBeTruthy();
    expect(em?.textContent).toBe('italic text');
  });

  it('renders a link with target=_blank and rel=noopener noreferrer', () => {
    render(<MarkdownRenderer content="[visit](https://example.com)" />);
    const link = screen.getByRole('link', { name: 'visit' });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('https://example.com');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders a code block with a language class', () => {
    render(<MarkdownRenderer content={'```python\nprint("hello")\n```'} />);
    // SyntaxHighlighter wraps in a div; verify code is present
    expect(document.body.textContent).toContain('print("hello")');
  });

  it('renders inline code', () => {
    render(<MarkdownRenderer content="Use `npm install` to set up." />);
    const code = document.querySelector('code');
    expect(code).toBeTruthy();
    expect(code?.textContent).toBe('npm install');
  });

  it('renders an unordered list', () => {
    render(
      <MarkdownRenderer
        content={`- item one\n- item two`}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('item one');
    expect(items[1].textContent).toBe('item two');
  });

  it('renders an ordered list', () => {
    render(
      <MarkdownRenderer
        content={`1. first\n2. second`}
      />,
    );
    expect(screen.getAllByRole('listitem').length).toBe(2);
  });

  it('renders a blockquote', () => {
    render(<MarkdownRenderer content="> quoted text" />);
    const bq = document.querySelector('blockquote');
    expect(bq).toBeTruthy();
    expect(bq?.textContent?.trim()).toBe('quoted text');
  });

  it('applies custom className to wrapper', () => {
    const { container } = render(<MarkdownRenderer content="hello" className="custom-class" />);
    expect(container.firstChild).toBeTruthy();
    expect((container.firstChild as HTMLElement).className).toContain('custom-class');
  });

  // ── GFM: tables ─────────────────────────────────────────────────────────────
  it('renders GFM pipe tables as HTML table elements', () => {
    const md = '| Name | Score |\n|------|-------|\n| Alice | 10 |\n| Bob | 8 |';
    const { container } = render(<MarkdownRenderer content={md} />);
    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelector('thead')).toBeTruthy();
    expect(container.querySelectorAll('tr').length).toBeGreaterThanOrEqual(2);
    expect(document.body.textContent).toContain('Alice');
    expect(document.body.textContent).toContain('Bob');
  });

  it('renders GFM table headers', () => {
    const md = '| Col A | Col B |\n|-------|-------|\n| 1 | 2 |';
    const { container } = render(<MarkdownRenderer content={md} />);
    const ths = container.querySelectorAll('th');
    expect(ths.length).toBe(2);
    expect(ths[0].textContent).toBe('Col A');
    expect(ths[1].textContent).toBe('Col B');
  });

  // ── GFM: task lists ──────────────────────────────────────────────────────────
  it('renders GFM task list checkboxes', () => {
    const md = '- [x] Done\n- [ ] Todo';
    const { container } = render(<MarkdownRenderer content={md} />);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
    // Verify checked state
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
    // Verify the component's override class contract and readOnly attribute
    // (catches class-precedence regressions in the MarkdownRenderer input override)
    expect((checkboxes[0] as HTMLInputElement).className).toContain('accent-solana-purple');
    expect((checkboxes[1] as HTMLInputElement).className).toContain('accent-solana-purple');
    expect((checkboxes[0] as HTMLInputElement).readOnly).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).readOnly).toBe(true);
  });

  // ── GFM: strikethrough ───────────────────────────────────────────────────────
  it('renders GFM strikethrough text', () => {
    render(<MarkdownRenderer content="~~deleted text~~" />);
    const del = document.querySelector('del');
    expect(del).toBeTruthy();
    expect(del?.textContent).toBe('deleted text');
  });

  // ── syntax highlighting languages ────────────────────────────────────────────
  it('renders TypeScript code block', () => {
    render(<MarkdownRenderer content={'```typescript\nconst x: number = 1;\n```'} />);
    expect(document.body.textContent).toContain('const x');
  });

  it('renders Rust code block', () => {
    render(<MarkdownRenderer content={'```rust\nfn main() { println!("hi"); }\n```'} />);
    expect(document.body.textContent).toContain('fn main');
  });

  it('renders Solidity code block', () => {
    render(<MarkdownRenderer content={'```solidity\npragma solidity ^0.8.0;\n```'} />);
    expect(document.body.textContent).toContain('pragma solidity');
  });

  // ── XSS safety ───────────────────────────────────────────────────────────────
  it('does not execute inline script tags (XSS safety)', () => {
    const xss = '<script>window.__xss = true;</script>text';
    render(<MarkdownRenderer content={xss} />);
    // react-markdown sanitises by default; window.__xss must not be set
    expect((window as unknown as Record<string, unknown>).__xss).toBeUndefined();
  });

  it('does not preserve javascript: protocol in link hrefs (XSS safety)', () => {
    const md = '[click me](javascript:window.__xss_js=1)';
    const { container } = render(<MarkdownRenderer content={md} />);
    const anchor = container.querySelector('a');
    // react-markdown strips javascript: URLs — href should be empty/null or
    // not contain the dangerous scheme
    const href = anchor?.getAttribute('href') ?? '';
    expect(href).not.toMatch(/^javascript:/i);
    expect((window as unknown as Record<string, unknown>).__xss_js).toBeUndefined();
  });

  it('does not preserve data: protocol in image src (XSS safety)', () => {
    const md = '![alt](data:text/html,<script>window.__xss_data=1</script>)';
    const { container } = render(<MarkdownRenderer content={md} />);
    const img = container.querySelector('img');
    // react-markdown strips data: URLs — src should be empty/null or not
    // contain the dangerous scheme
    const src = img?.getAttribute('src') ?? '';
    expect(src).not.toMatch(/^data:text\/html/i);
    expect((window as unknown as Record<string, unknown>).__xss_data).toBeUndefined();
  });
});
