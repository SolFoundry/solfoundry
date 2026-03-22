/**
 * MarkdownRenderer — Reusable component for rendering Markdown content safely.
 *
 * Uses react-markdown + remark-gfm (tables, task lists, strikethrough, autolinks),
 * rehype-sanitize (GitHub-style schema, XSS hardening), and Prism for fenced blocks.
 * Uses PrismLight with only python, typescript (via tsx), rust, solidity registered
 * to limit bundle size vs. the full Prism build.
 *
 * @module components/common/MarkdownRenderer
 */
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import solidity from "react-syntax-highlighter/dist/esm/languages/prism/solidity";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import {
  oneLight,
  vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";

SyntaxHighlighter.registerLanguage("tsx", tsx);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("rust", rust);
SyntaxHighlighter.registerLanguage("solidity", solidity);
import type { Components } from "react-markdown";
import type { ResolvedTheme } from "../../contexts/ThemeContext";
import { useResolvedThemeSafe } from "../../contexts/ThemeContext";

/** Map common fence labels to Prism language ids (python, typescript, rust, solidity, …). */
const CODE_LANG_ALIASES: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  rs: "rust",
  sol: "solidity",
};

export interface MarkdownRendererProps {
  /** Markdown string to render. Renders nothing when empty or undefined. */
  content: string | null | undefined;
  /** Optional additional CSS classes applied to the wrapper element. */
  className?: string;
}

function resolvePrismLanguage(raw: string): string {
  const lower = raw.toLowerCase();
  return CODE_LANG_ALIASES[lower] ?? lower;
}

function makeMarkdownComponents(resolved: ResolvedTheme): Components {
  const codeStyle = resolved === "dark" ? vscDarkPlus : oneLight;

  return {
    // Fenced blocks are `<pre><code>`; unwrap `pre` so SyntaxHighlighter is not nested in `<pre>`.
    pre({ children }) {
      return <>{children}</>;
    },

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

      const language = resolvePrismLanguage(match[1]);

      return (
        <div className="rounded-lg my-4 overflow-hidden border border-gray-200 dark:border-white/10">
          <SyntaxHighlighter
            style={codeStyle}
            language={language}
            PreTag="div"
            className="!m-0 !rounded-none text-sm"
          >
            {String(children).replace(/\n$/, "")}
          </SyntaxHighlighter>
        </div>
      );
    },

    a({ href, children, node: _node, title, ...props }) {
      return (
        <a
          {...props}
          href={href}
          title={title}
          target="_blank"
          rel="noopener noreferrer"
          className="text-solana-purple hover:text-solana-green underline underline-offset-2 transition-colors"
        >
          {children}
        </a>
      );
    },

    img({ src, alt, node: _node, title, ...props }) {
      return (
        <img
          {...props}
          src={src}
          alt={alt ?? ""}
          title={title}
          loading="lazy"
          decoding="async"
          className="max-w-full h-auto rounded-lg my-3 border border-gray-200 dark:border-white/10"
        />
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
    h4: ({ children }) => (
      <h4 className="text-base font-semibold text-gray-900 dark:text-white mt-3 mb-2">
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 className="text-sm font-semibold text-gray-900 dark:text-white mt-3 mb-1">
        {children}
      </h5>
    ),
    h6: ({ children }) => (
      <h6 className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-3 mb-1">
        {children}
      </h6>
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

    del: ({ children }) => (
      <del className="text-gray-500 dark:text-gray-500 line-through">{children}</del>
    ),
  };
}

/**
 * Renders Markdown with light/dark prose and syntax-highlighted code blocks.
 * Safe against XSS: virtual DOM from react-markdown + rehype-sanitize (no raw HTML by default).
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
        `[&_ol]:text-gray-700 [&_ol]:dark:text-gray-300 ` +
        `[&_.contains-task-list]:list-none [&_.contains-task-list]:ml-0 ` +
        `[&_.task-list-item]:flex [&_.task-list-item]:items-start [&_.task-list-item]:gap-2 ` +
        `[&_.task-list-item_input]:mt-1 ${className ?? ""}`
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
