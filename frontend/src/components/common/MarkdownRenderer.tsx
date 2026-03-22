/**
 * MarkdownRenderer — Safe, themed Markdown for bounty descriptions and similar content.
 *
 * - **Parsing:** `react-markdown` + `remark-gfm` (tables, task lists, strikethrough, autolinks).
 * - **Sanitization:** `rehype-sanitize` (GitHub-style schema: safe `href`/`src`, task-list inputs).
 * - **Code:** `react-syntax-highlighter/prism-light` with only Python, TypeScript, Rust, Solidity,
 *   plus `clike` as fallback — smaller than importing the full Prism build (~all refractor langs).
 * - **Security:** No `dangerouslySetInnerHTML`; links open with `rel="noopener noreferrer"`.
 *
 * @module components/common/MarkdownRenderer
 */
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { PrismLight } from 'react-syntax-highlighter';
import oneLight from 'react-syntax-highlighter/dist/esm/styles/prism/one-light';
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus';
import clike from 'react-syntax-highlighter/dist/esm/languages/prism/clike';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import solidity from 'react-syntax-highlighter/dist/esm/languages/prism/solidity';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import type { ResolvedTheme } from '../../contexts/ThemeContext';
import { useResolvedThemeSafe } from '../../contexts/ThemeContext';

PrismLight.registerLanguage('clike', clike);
PrismLight.registerLanguage('python', python);
PrismLight.registerLanguage('typescript', typescript);
PrismLight.registerLanguage('rust', rust);
PrismLight.registerLanguage('solidity', solidity);

export interface MarkdownRendererProps {
  /** Markdown string to render. Renders nothing when empty or undefined. */
  content: string | null | undefined;
  /** Optional additional CSS classes applied to the wrapper element. */
  className?: string;
}

const LANGUAGE_ALIASES: Record<string, string> = {
  py: 'python',
  ts: 'typescript',
  tsx: 'typescript',
  sol: 'solidity',
};

function resolvePrismLanguage(raw: string): string {
  const normalized = (LANGUAGE_ALIASES[raw.toLowerCase()] ?? raw).toLowerCase();
  if (normalized === 'python' || normalized === 'typescript' || normalized === 'rust' || normalized === 'solidity') {
    return normalized;
  }
  return 'clike';
}

function makeMarkdownComponents(resolved: ResolvedTheme): Components {
  const codeStyle = resolved === 'dark' ? vscDarkPlus : oneLight;

  return {
    code({ className, children, node: _node, ...props }) {
      const match = /language-([\w-]+)/.exec(className ?? '');
      if (!match) {
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
        <PrismLight style={codeStyle} language={language} PreTag="div" className="m-0! rounded-none! text-sm">
          {String(children).replace(/\n$/, '')}
        </PrismLight>
      );
    },

    pre({ children }) {
      return (
        <div className="rounded-lg my-4 overflow-hidden border border-gray-200 dark:border-white/10">
          {children}
        </div>
      );
    },

    a({ href, children, node: _node, ...props }) {
      if (!href) {
        return <span className="text-gray-700 dark:text-gray-300">{children}</span>;
      }
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

    img({ src, alt, node: _node, ...props }) {
      return (
        <img
          src={src}
          alt={alt ?? ''}
          className="max-w-full h-auto rounded-lg my-3 border border-gray-200 dark:border-white/10"
          loading="lazy"
          decoding="async"
          {...props}
        />
      );
    },

    h1: ({ children }) => (
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-6 mb-3">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-5 mb-2">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">{children}</h3>
    ),

    p: ({ children }) => (
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">{children}</p>
    ),

    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-solana-purple pl-4 my-3 text-gray-600 dark:text-gray-400 italic">
        {children}
      </blockquote>
    ),

    table: ({ children }) => (
      <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 dark:border-white/10">
        <table className="w-full border-collapse text-sm text-gray-700 dark:text-gray-300">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="border-b border-gray-200 bg-surface-light-100 dark:border-white/10 dark:bg-white/5">
        {children}
      </thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr className="border-b border-gray-100 dark:border-white/5 last:border-0">{children}</tr>,
    th: ({ children }) => (
      <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">{children}</th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 border-b border-gray-100 dark:border-white/5">{children}</td>
    ),

    hr: () => <hr className="border-gray-200 dark:border-white/10 my-4" />,

    strong: ({ children }) => (
      <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
    ),
    em: ({ children }) => <em className="italic text-gray-700 dark:text-gray-300">{children}</em>,

    del: ({ children }) => (
      <del className="text-gray-500 dark:text-gray-500 line-through">{children}</del>
    ),

    input: ({ node: _node, ...props }) => (
      <input {...props} className="mr-2 mt-0.5 shrink-0 align-top accent-solana-purple" readOnly />
    ),
  };
}

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeSanitize];

/**
 * Renders Markdown with GFM, light/dark prose, syntax-highlighted fenced code, and sanitization.
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const resolved = useResolvedThemeSafe();
  const components = useMemo(() => makeMarkdownComponents(resolved), [resolved]);

  if (!content) return null;

  return (
    <div
      className={
        `[&_ul]:list-disc [&_ul]:list-outside [&_ul]:ml-6 [&_ul]:space-y-1 [&_ul]:mb-3 ` +
        `[&_ol]:list-decimal [&_ol]:list-outside [&_ol]:ml-6 [&_ol]:space-y-1 [&_ol]:mb-3 ` +
        `[&_li]:leading-relaxed [&_ul]:text-gray-700 [&_ul]:dark:text-gray-300 ` +
        `[&_ol]:text-gray-700 [&_ol]:dark:text-gray-300 ` +
        `[&_li]:marker:text-gray-500 [&_li]:dark:marker:text-gray-400 ` +
        `[&_ul.contains-task-list]:list-none [&_ul.contains-task-list]:ml-0 ` +
        `[&_ol.contains-task-list]:list-none [&_ol.contains-task-list]:ml-0 ` +
        `[&_li.task-list-item]:flex [&_li.task-list-item]:items-start [&_li.task-list-item]:gap-1 ${className ?? ''}`
      }
    >
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
