import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * MarkdownRenderer - Renders Markdown content with syntax highlighting
 *
 * Features:
 * - Standard Markdown: headings, bold, italic, code blocks, lists, links
 * - Syntax highlighting for code blocks (dark theme)
 * - Links open in new tab (secure)
 * - XSS-safe (react-markdown sanitizes by default)
 * - Supports tables, blockquotes, inline code
 * - Dark theme styling matching existing site
 */

export interface MarkdownRendererProps {
  /** Markdown content to render */
  content: string;
  /** Optional additional CSS classes */
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Memoize the rendered content
  const rendered = useMemo(() => {
    if (!content) return null;

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code blocks with syntax highlighting
          code({ inline, className: codeClassName, children, ...props }: any) {
            const match = /language-(\w+)/.exec(codeClassName || '');
            const language = match ? match[1] : '';

            if (!inline && language) {
              return (
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={language}
                  PreTag="div"
                  className="rounded-lg !bg-[#1a1a1a] !p-4 my-4 overflow-x-auto"
                  customStyle={{
                    margin: 0,
                    background: '#1a1a1a',
                    padding: '1rem',
                  }}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              );
            }

            // Inline code
            if (inline) {
              return (
                <code
                  className="bg-[#14F195]/10 text-[#14F195] px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            // Code block without language
            return (
              <code
                className="block bg-[#1a1a1a] p-4 rounded-lg my-4 font-mono text-sm overflow-x-auto"
                {...props}
              >
                {children}
              </code>
            );
          },

          // Links open in new tab
          a({ href, children, ...props }: any) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#14F195] hover:text-[#9945FF] transition-colors underline"
                {...props}
              >
                {children}
              </a>
            );
          },

          // Headings
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold text-white mt-6 mb-4">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-bold text-white mt-5 mb-3">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-bold text-white mt-4 mb-2">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-lg font-bold text-white mt-3 mb-2">{children}</h4>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="text-gray-300 leading-relaxed mb-4">{children}</p>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-1">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-300">{children}</li>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#9945FF] pl-4 py-2 my-4 bg-[#9945FF]/5 rounded-r">
              {children}
            </blockquote>
          ),

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border border-white/10 rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#9945FF]/10">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-white font-semibold border-b border-white/10">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-gray-300 border-b border-white/5">{children}</td>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-white/5 transition-colors">{children}</tr>
          ),

          // Horizontal rule
          hr: () => <hr className="border-white/10 my-6" />,

          // Strong and emphasis
          strong: ({ children }) => (
            <strong className="font-bold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-200">{children}</em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
  }, [content]);

  if (!content) {
    return (
      <div className={`text-gray-500 italic ${className}`}>
        No content to display
      </div>
    );
  }

  return (
    <div className={`markdown-body prose prose-invert max-w-none ${className}`}>
      {rendered}
    </div>
  );
}

export default MarkdownRenderer;