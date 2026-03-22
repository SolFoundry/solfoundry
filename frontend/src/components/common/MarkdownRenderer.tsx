/**
 * MarkdownRenderer — Reusable component for rendering Markdown content safely.
 *
 * Uses react-markdown for parsing and react-syntax-highlighter for code blocks.
 * CommonMark only — GFM pipe tables are not parsed as HTML tables (no extra remark plugins).
 * All links open in a new tab with rel="noopener noreferrer" for security.
 * HTML output is XSS-safe: react-markdown does not use dangerouslySetInnerHTML.
 *
 * @module components/common/MarkdownRenderer
 */
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneLight,
  vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Components } from "react-markdown";
import type { ResolvedTheme } from "../../contexts/ThemeContext";
import { useResolvedThemeSafe } from "../../contexts/ThemeContext";

export interface MarkdownRendererProps {
  /** Markdown string to render. Renders nothing when empty or undefined. */
  content: string | null | undefined;
  /** Optional additional CSS classes applied to the wrapper element. */
  className?: string;
}

function makeMarkdownComponents(resolved: ResolvedTheme): Components {
  const codeStyle = resolved === "dark" ? vscDarkPlus : oneLight;

  return {
    code({ node: _node, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className ?? "");
      const isInline = !match;

      if (isInline) {
        return (
          <code
            className="px-1.5 py-0.5 rounded bg-surface-light-200 dark:bg-white/10 text-solana-green font-mono text-sm"
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <div className="rounded-lg my-4 overflow-hidden border border-gray-200 dark:border-white/10">
          <SyntaxHighlighter
            style={codeStyle}
            language={match[1]}
            PreTag="div"
            className="!m-0 !rounded-none text-sm"
          >
            {String(children).replace(/\n$/, "")}
          </SyntaxHighlighter>
        </div>
      );
    },

    a({ href, children, ...props }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-solana-purple hover:text-solana-green underline underline-offset-2 transition-colors"
          {...props}
        >
          {children}
        </a>
      );
    },

    h1: ({ children }) => (
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-6 mb-3">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-5 mb-2">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
        {children}
      </h3>
    ),

    p: ({ children }) => (
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
        {children}
      </p>
    ),

    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-solana-purple pl-4 my-3 text-gray-600 dark:text-gray-400 italic">
        {children}
      </blockquote>
    ),

    table: ({ children }) => (
      <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 dark:border-white/10">
        <table className="w-full border-collapse text-sm text-gray-700 dark:text-gray-300">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="border-b border-gray-200 bg-surface-light-100 dark:border-white/10 dark:bg-white/5">
        {children}
      </thead>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 border-b border-gray-100 dark:border-white/5">
        {children}
      </td>
    ),

    hr: () => <hr className="border-gray-200 dark:border-white/10 my-4" />,

    strong: ({ children }) => (
      <strong className="font-semibold text-gray-900 dark:text-white">
        {children}
      </strong>
    ),
    em: ({ children }) => (
      <em className="italic text-gray-700 dark:text-gray-300">{children}</em>
    ),
  };
}

/**
 * Renders Markdown with light/dark prose and syntax-highlighted code blocks.
 * Safe against XSS: relies on react-markdown which does not use dangerouslySetInnerHTML.
 */
export function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  const resolved = useResolvedThemeSafe();
  const components = useMemo(
    () => makeMarkdownComponents(resolved),
    [resolved],
  );

  if (!content) return null;

  return (
    <div
      className={
        `[&_ul]:list-disc [&_ul]:list-outside [&_ul]:ml-6 [&_ul]:space-y-1 [&_ul]:mb-3 ` +
        `[&_ol]:list-decimal [&_ol]:list-outside [&_ol]:ml-6 [&_ol]:space-y-1 [&_ol]:mb-3 ` +
        `[&_li]:leading-relaxed [&_ul]:text-gray-700 [&_ul]:dark:text-gray-300 ` +
        `[&_ol]:text-gray-700 [&_ol]:dark:text-gray-300 ${className ?? ""}`
      }
    >
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
