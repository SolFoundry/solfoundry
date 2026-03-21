import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

// ============================================================================
// Types
// ============================================================================

export interface MarkdownRendererProps {
  /** Markdown string to render */
  content: string;
  /** Additional CSS classes for the wrapper */
  className?: string;
}

// ============================================================================
// Custom renderers — dark-theme styling matching SolFoundry design system
// ============================================================================

const components: Components = {
  // Headings
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-white mt-6 mb-3 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold text-white mt-5 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-gray-100 mt-4 mb-2 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-semibold text-gray-200 mt-3 mb-1 first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="text-sm font-semibold text-gray-300 mt-3 mb-1 first:mt-0">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="text-sm font-medium text-gray-400 mt-2 mb-1 first:mt-0">{children}</h6>
  ),

  // Paragraph
  p: ({ children }) => (
    <p className="text-sm text-gray-300 leading-relaxed mb-3 last:mb-0">{children}</p>
  ),

  // Bold / italic
  strong: ({ children }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-200">{children}</em>
  ),

  // Inline code
  code: ({ children, className: cls }) => {
    const isBlock = cls?.startsWith('language-');
    if (isBlock) {
      // Handled by pre/code combo below — return plain span
      return <code className={cls}>{children}</code>;
    }
    return (
      <code className="text-[#14F195] bg-[#14F195]/10 px-1.5 py-0.5 rounded text-xs font-mono">
        {children}
      </code>
    );
  },

  // Code blocks
  pre: ({ children }) => (
    <pre className="bg-[#111] border border-white/10 rounded-lg p-4 overflow-x-auto my-4 text-xs leading-relaxed font-mono text-gray-300">
      {children}
    </pre>
  ),

  // Links — open in new tab
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#9945FF] hover:text-[#14F195] underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="list-disc list-inside text-sm text-gray-300 space-y-1 mb-3 pl-2">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside text-sm text-gray-300 space-y-1 mb-3 pl-2">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-[#9945FF] pl-4 my-4 text-gray-400 italic">
      {children}
    </blockquote>
  ),

  // Horizontal rule
  hr: () => <hr className="border-white/10 my-6" />,

  // Table
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm text-gray-300 border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-white/20 text-gray-400">{children}</thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y divide-white/10">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-white/5 transition-colors">{children}</tr>,
  th: ({ children }) => (
    <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2 leading-relaxed">{children}</td>,
};

// ============================================================================
// Component
// ============================================================================

/**
 * MarkdownRenderer — renders Markdown content safely using react-markdown.
 *
 * react-markdown does not use dangerouslySetInnerHTML, so output is XSS-safe
 * by default. Styled to match SolFoundry's dark design system.
 *
 * @example
 * <MarkdownRenderer content={bounty.description} />
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div className={`markdown-renderer ${className}`}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;
