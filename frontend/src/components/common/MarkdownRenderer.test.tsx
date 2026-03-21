/**
 * MarkdownRenderer Tests
 * @module components/common/MarkdownRenderer.test
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownRenderer } from './MarkdownRenderer';

describe('MarkdownRenderer', () => {
  describe('basic rendering', () => {
    it('renders plain text', () => {
      render(<MarkdownRenderer content="Hello, World!" />);
      expect(screen.getByText('Hello, World!')).toBeInTheDocument();
    });

    it('renders headings correctly', () => {
      const { container } = render(<MarkdownRenderer content="# Main Title\n## Subtitle\n### Section" />);
      
      expect(container.querySelector('h1')).toHaveTextContent('Main Title');
      expect(container.querySelector('h2')).toHaveTextContent('Subtitle');
      expect(container.querySelector('h3')).toHaveTextContent('Section');
    });

    it('renders bold and italic text', () => {
      const { container } = render(<MarkdownRenderer content="**bold** and *italic*" />);
      
      expect(container.querySelector('strong')).toHaveTextContent('bold');
      expect(container.querySelector('em')).toHaveTextContent('italic');
    });
  });

  describe('code blocks', () => {
    it('renders inline code', () => {
      const { container } = render(<MarkdownRenderer content="Use `npm install` to install" />);
      
      const code = container.querySelector('code');
      expect(code).toHaveTextContent('npm install');
      expect(code).toBeInTheDocument();
    });

    it('renders code blocks with content', () => {
      const content = '```javascript\nconst x = 1;\n```';
      const { container } = render(<MarkdownRenderer content={content} />);
      
      // Verify code content is rendered
      expect(container.textContent).toContain('const x = 1;');
      // Verify syntax highlighter creates nested spans for tokens
      const spans = container.querySelectorAll('span');
      expect(spans.length).toBeGreaterThan(0);
    });

    it('renders code blocks without language', () => {
      const content = '```\nplain text code\n```';
      render(<MarkdownRenderer content={content} />);
      
      expect(screen.getByText(/plain text code/)).toBeInTheDocument();
    });
  });

  describe('links', () => {
    it('renders external links that open in new tab', () => {
      const { container } = render(<MarkdownRenderer content="[SolFoundry](https://solfoundry.org)" />);
      
      const link = container.querySelector('a');
      expect(link).toHaveAttribute('href', 'https://solfoundry.org');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders internal anchor links without new tab', () => {
      const { container } = render(<MarkdownRenderer content="[Section](#section)" />);
      
      const link = container.querySelector('a');
      expect(link).toHaveAttribute('href', '#section');
      expect(link).not.toHaveAttribute('target', '_blank');
    });
  });

  describe('lists', () => {
    it('renders unordered lists', () => {
      const { container } = render(<MarkdownRenderer content="- Item 1\n- Item 2\n- Item 3" />);
      
      const list = container.querySelector('ul');
      expect(list).toBeTruthy();
      expect(container.querySelectorAll('li')).toHaveLength(3);
    });

    it('renders ordered lists', () => {
      const { container } = render(<MarkdownRenderer content="1. First\n2. Second\n3. Third" />);
      
      const list = container.querySelector('ol');
      expect(list).toBeTruthy();
      expect(container.querySelectorAll('li')).toHaveLength(3);
    });
  });

  describe('edge cases', () => {
    it('handles empty content gracefully', () => {
      render(<MarkdownRenderer content="" />);
      expect(screen.getByText('No content available')).toBeInTheDocument();
    });

    it('handles null content gracefully', () => {
      render(<MarkdownRenderer content={null as unknown as string} />);
      expect(screen.getByText('No content available')).toBeInTheDocument();
    });

    it('handles whitespace-only content', () => {
      render(<MarkdownRenderer content="   \n\t  " />);
      expect(screen.getByText('No content available')).toBeInTheDocument();
    });
  });

  describe('blockquotes', () => {
    it('renders blockquotes', () => {
      const { container } = render(<MarkdownRenderer content="> This is a quote" />);
      
      const blockquote = container.querySelector('blockquote');
      expect(blockquote).toBeTruthy();
      expect(blockquote).toHaveTextContent('This is a quote');
    });
  });

  describe('tables', () => {
    it('renders tables', () => {
      const content = `| Name | Value |
|------|-------|
| Test | 123   |`;
      
      const { container } = render(<MarkdownRenderer content={content} />);
      
      expect(container.querySelector('table')).toBeTruthy();
      expect(container.querySelector('th')).toHaveTextContent('Name');
    });
  });

  describe('styling', () => {
    it('applies custom className', () => {
      const { container } = render(<MarkdownRenderer content="Test" className="custom-class" />);
      
      expect(container.querySelector('.markdown-content')).toHaveClass('custom-class');
    });
  });

  describe('strikethrough (GFM)', () => {
    it('renders strikethrough text with del element', () => {
      const { container } = render(<MarkdownRenderer content="~~deleted text~~" />);
      
      // Check that strikethrough is rendered with proper element
      const deletedElement = container.querySelector('del') || container.querySelector('s');
      expect(deletedElement).toBeTruthy();
      expect(deletedElement).toHaveTextContent('deleted text');
    });
  });

  describe('XSS safety', () => {
    it('sanitizes dangerous HTML attributes', () => {
      const content = '<img src="x" onerror="alert(1)">';
      const { container } = render(<MarkdownRenderer content={content} />);
      
      const img = container.querySelector('img');
      // If img is rendered, ensure it has no dangerous attributes
      if (img) {
        expect(img.getAttribute('onerror')).toBeNull();
      }
    });

    it('sanitizes javascript: URLs', () => {
      const content = '[Click me](javascript:alert(1))';
      const { container } = render(<MarkdownRenderer content={content} />);
      
      const link = container.querySelector('a');
      expect(link).toBeTruthy();
      // The href should be sanitized or removed
      const href = link?.getAttribute('href');
      expect(href === null || href === '' || !href?.startsWith('javascript:')).toBeTruthy();
    });
  });
});