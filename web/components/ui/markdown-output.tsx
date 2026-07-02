"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
  streaming?: boolean;
  className?: string;
  maxHeight?: string;
}

export function MarkdownOutput({ content, streaming, className, maxHeight = "28rem" }: Props) {
  return (
    <div
      className={`overflow-auto text-sm leading-relaxed ${className ?? ""}`}
      style={{ maxHeight }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-2 mt-4 text-base font-bold first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-3 text-sm font-semibold text-foreground first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-2 text-sm font-medium first:mt-0">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          hr: () => <hr className="my-3 border-border" />,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-primary/50 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ children, className: cls }) => {
            const isBlock = Boolean(cls?.includes("language-"));
            return isBlock ? (
              <pre className="my-2 overflow-x-auto rounded-md bg-secondary p-3 text-xs">
                <code>{children}</code>
              </pre>
            ) : (
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          th: ({ children }) => (
            <th className="border border-border bg-secondary px-2 py-1 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1">{children}</td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && <span className="animate-pulse text-muted-foreground">▍</span>}
    </div>
  );
}
