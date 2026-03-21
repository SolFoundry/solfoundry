/**
 * MarkdownRenderer — Reusable component for rendering Markdown content
 * Used for bounty descriptions, review feedback, and rich text content
 * @module components/common/MarkdownRenderer
 */
import { useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ============================================================================
// Types
// ============================================================================

export interface MarkdownRendererProps {
  /** Markdown content to render */
  content: string;
  /** Optional additional CSS classes */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a URL is external (should open in new tab)
 */
function isExternalLink(href: string | undefined): boolean {
  if (!href) return false;
  return href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//');
}

// ============================================================================
// Custom Renderers (properly typed)
// ============================================================================

const codeRenderer: Components['code'] = ({ className, children }) => {
  const match = /language-(\w+)/.exec(className || '');
  const isInline = !match && !className;
  
  // Inline code
  if (isInline) {
    return (
      <code className="bg-[#1a1a1a] text-[#14F195] px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    );
  }
  
  // Block code with syntax highlighting
  return (
    <div className="relative my-4">
      {match && (
        <span className="absolute top-2 right-2 text-xs text-gray-500 font-mono">
          {match[1]}
        </span>
      )}
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={match ? match[1] : 'text'}
        PreTag="div"
        className="rounded-lg !bg-[#1a1a1a] !p-4 text-sm overflow-x-auto"
        customStyle={{
          margin: 0,
          background: '#1a1a1a',
          padding: '1rem',
        }}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  );
};

const linkRenderer: Components['a'] = ({ href, children }) => {
  const isExternal = isExternalLink(href);
  
  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="text-[#14F195] hover:text-[#9945FF] underline transition-colors"
    >
      {children}
    </a>
  );
};

const components: Components = {
  // Code blocks with syntax highlighting
  code: codeRenderer,
  
  // Headings with proper styling
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-white mt-6 mb-4">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-bold text-white mt-5 mb-3">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-semibold text-white mt-3 mb-2">{children}</h4>
  ),
  
  // Paragraphs
  p: ({ children }) => (
    <p className="text-gray-300 leading-relaxed mb-3">{children}</p>
  ),
  
  // Links - external links open in new tab
  a: linkRenderer,
  
  // Lists
  ul: ({ children }) => (
    <ul className="list-disc list-inside text-gray-300 space-y-1 mb-3 ml-4">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside text-gray-300 space-y-1 mb-3 ml-4">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-gray-300">{children}</li>
  ),
  
  // Blockquotes
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-[#9945FF] pl-4 my-4 text-gray-400 italic">
      {children}
    </blockquote>
  ),
  
  // Tables
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full border border-white/10">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[#1a1a1a]">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-white/10">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-white/5">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2 text-left text-gray-300 font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2 text-gray-300">{children}</td>
  ),
  
  // Horizontal rule
  hr: () => (
    <hr className="border-white/10 my-6" />
  ),
  
  // Strong and emphasis
  strong: ({ children }) => (
    <strong className="font-bold text-white">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-gray-200">{children}</em>
  ),
};

// ============================================================================
// Component
// ============================================================================

/**
 * MarkdownRenderer component
 * 
 * Features:
 * - Renders standard Markdown (headings, bold, italic, code, lists, links, etc.)
 * - Syntax highlighting for code blocks using VS Code dark theme
 * - XSS-safe through react-markdown's default sanitization
 * - External links open in new tab with security attributes
 * - Dark theme styling matching site design
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Memoize content to prevent unnecessary re-renders
  const memoizedContent = useMemo(() => content ?? '', [content]);

  // Handle empty/null content gracefully
  if (!memoizedContent || memoizedContent.trim() === '') {
    return (
      <div className={`text-gray-500 text-sm italic ${className}`}>
        No content available
      </div>
    );
  }

  return (
    <div className={`markdown-content prose prose-invert max-w-none ${className}`}>
      <ReactMarkdown components={components}>
        {memoizedContent}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;