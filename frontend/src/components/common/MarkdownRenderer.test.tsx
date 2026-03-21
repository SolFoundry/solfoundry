import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownRenderer } from './MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('renders basic text', () => {
    render(<MarkdownRenderer content="Hello world" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders headings', () => {
    const { container } = render(<MarkdownRenderer content="# Heading 1\n## Heading 2\n### Heading 3" />);
    expect(container.querySelector('h1')).toHaveTextContent('Heading 1');
    expect(container.querySelector('h2')).toHaveTextContent('Heading 2');
    expect(container.querySelector('h3')).toHaveTextContent('Heading 3');
  });

  it('renders bold and italic text', () => {
    const { container } = render(<MarkdownRenderer content="**bold** and *italic*" />);
    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelector('em')).toHaveTextContent('italic');
  });

  it('renders inline code', () => {
    const { container } = render(<MarkdownRenderer content="Use `npm install` to install" />);
    const code = container.querySelector('code');
    expect(code).toHaveTextContent('npm install');
    expect(code?.className).toContain('text-[#14F195]');
  });

  it('renders code blocks with syntax highlighting', () => {
    const { container } = render(
      <MarkdownRenderer content={'```javascript\nconst x = 1;\n```'} />
    );
    // SyntaxHighlighter renders in a div
    expect(container.querySelector('.rounded-lg')).toBeInTheDocument();
  });

  it('renders links that open in new tab', () => {
    const { container } = render(
      <MarkdownRenderer content="[Link](https://example.com)" />
    );
    const link = container.querySelector('a');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders unordered lists', () => {
    const { container } = render(
      <MarkdownRenderer content="- Item 1\n- Item 2\n- Item 3" />
    );
    const list = container.querySelector('ul');
    expect(list).toBeInTheDocument();
    expect(list?.querySelectorAll('li')).toHaveLength(3);
  });

  it('renders ordered lists', () => {
    const { container } = render(
      <MarkdownRenderer content="1. First\n2. Second\n3. Third" />
    );
    const list = container.querySelector('ol');
    expect(list).toBeInTheDocument();
    expect(list?.querySelectorAll('li')).toHaveLength(3);
  });

  it('renders blockquotes', () => {
    const { container } = render(
      <MarkdownRenderer content="> This is a quote" />
    );
    const quote = container.querySelector('blockquote');
    expect(quote).toBeInTheDocument();
    expect(quote?.className).toContain('border-[#9945FF]');
  });

  it('renders tables', () => {
    const content = `| Name | Age |
|------|-----|
| John | 25  |
| Jane | 30  |`;
    const { container } = render(<MarkdownRenderer content={content} />);
    expect(container.querySelector('table')).toBeInTheDocument();
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('td')).toHaveLength(4);
  });

  it('handles empty content gracefully', () => {
    render(<MarkdownRenderer content="" />);
    expect(screen.getByText('No content to display')).toBeInTheDocument();
  });

  it('handles null/undefined content gracefully', () => {
    render(<MarkdownRenderer content={null as any} />);
    expect(screen.getByText('No content to display')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <MarkdownRenderer content="Test" className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders horizontal rules', () => {
    const { container } = render(<MarkdownRenderer content="Before\n\n---\n\nAfter" />);
    expect(container.querySelector('hr')).toBeInTheDocument();
  });

  it('renders GFM features (strikethrough)', () => {
    const { container } = render(<MarkdownRenderer content="~~strikethrough~~" />);
    expect(container.querySelector('del')).toHaveTextContent('strikethrough');
  });
});