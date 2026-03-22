/**
 * MarkdownRenderer — Reusable component for rendering Markdown content safely.
 *
 * Uses react-markdown for parsing and react-syntax-highlighter for code blocks.
 * All links open in a new tab with rel="noopener noreferrer" for security.
 * HTML output is XSS-safe: react-markdown does not use dangerouslySetInnerHTML.
 *
 * @module components/common/MarkdownRenderer
 */
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';

export interface MarkdownRendererProps {
  /** Markdown string to render. Renders nothing when empty or undefined. */
  content: string | null | undefined;
  /** Optional additional CSS classes applied to the wrapper element. */
  className?: string;
}

// ── Custom component overrides ────────────────────────────────────────────────

const components: Components = {
  // Code blocks — use SyntaxHighlighter for multi-line, inline style for single-line
  code({ node: _node, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? '');
    const isInline = !match;

    if (isInline) {
      return (
        <code
          className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-[#14F195] font-mono text-sm"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={match[1]}
        PreTag="div"
        className="rounded-lg my-4 text-sm"
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    );
  },

  // Links — always open externally and safely
  a({ href, children, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#9945FF] hover:text-[#14F195] underline underline-offset-2 transition-colors"
        {...props}
      >
        {children}
      </a>
    );
  },

  // Headings
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-6 mb-3">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-5 mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">{children}</h3>
  ),

  // Paragraph
  p: ({ children }) => (
    <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-3">{children}</p>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 mb-3 ml-2">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside text-gray-600 dark:text-gray-300 space-y-1 mb-3 ml-2">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-[#9945FF] pl-4 my-3 text-gray-400 italic">
      {children}
    </blockquote>
  ),

  // Table
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full border-collapse text-sm text-gray-300">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-gray-200 dark:border-white/10">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border-b border-gray-100 dark:border-white/5">{children}</td>
  ),

  // Horizontal rule
  hr: () => <hr className="border-gray-200 dark:border-white/10 my-4" />,

  // Bold / italic
  strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-600 dark:text-gray-300">{children}</em>,
};

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Renders Markdown content with dark-theme styling and syntax-highlighted code blocks.
 * Safe against XSS: relies on react-markdown which does not use dangerouslySetInnerHTML.
 *
 * @example
 * <MarkdownRenderer content={bounty.description} className="max-w-prose" />
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div className={className}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
