import React from 'react';
import { render, screen } from '@testing-library/react';
import { MarkdownRenderer } from './MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('renders headings', () => {
    render(<MarkdownRenderer content="# Hello World" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello World');
  });

  it('renders h2 and h3 headings', () => {
    render(<MarkdownRenderer content={`## Section\n### Subsection`} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Section');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Subsection');
  });

  it('renders bold and italic text', () => {
    render(<MarkdownRenderer content="**bold** and _italic_" />);
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('italic').tagName).toBe('EM');
  });

  it('renders unordered lists', () => {
    render(<MarkdownRenderer content={`- item one\n- item two`} />);
    expect(screen.getByText('item one')).toBeInTheDocument();
    expect(screen.getByText('item two')).toBeInTheDocument();
  });

  it('renders ordered lists', () => {
    render(<MarkdownRenderer content={`1. first\n2. second`} />);
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
  });

  it('renders inline code', () => {
    render(<MarkdownRenderer content="use `npm install` to install" />);
    expect(screen.getByText('npm install').tagName).toBe('CODE');
  });

  it('renders a code block', () => {
    render(<MarkdownRenderer content={"```js\nconsole.log('hi');\n```"} />);
    expect(screen.getByText("console.log('hi');")).toBeInTheDocument();
  });

  it('renders links that open in a new tab', () => {
    render(<MarkdownRenderer content="[SolFoundry](https://solfoundry.org)" />);
    const link = screen.getByRole('link', { name: 'SolFoundry' });
    expect(link).toHaveAttribute('href', 'https://solfoundry.org');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders blockquotes', () => {
    render(<MarkdownRenderer content="> This is a quote" />);
    expect(screen.getByText('This is a quote')).toBeInTheDocument();
  });

  it('returns null for empty string', () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container.firstChild).toBeNull();
  });

  it('applies custom className to wrapper', () => {
    const { container } = render(
      <MarkdownRenderer content="hello" className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders tables', () => {
    const table = `| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |`;
    render(<MarkdownRenderer content={table} />);
    expect(screen.getByText('Header 1')).toBeInTheDocument();
    expect(screen.getByText('Cell 1')).toBeInTheDocument();
  });
});
