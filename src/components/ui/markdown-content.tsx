import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
  /** Renders without block spacing (headings/lists collapse to inline text) — for single-line contexts like a title. */
  inline?: boolean;
}

const blockComponents = {
  h1: ({ children }: any) => <h1 className="text-base font-bold mt-3 mb-1.5 first:mt-0">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-sm font-bold mt-3 mb-1.5 first:mt-0">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h3>,
  p: ({ children }: any) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }: any) => <ul className="list-disc pl-5 mb-2 space-y-0.5 last:mb-0">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-2 space-y-0.5 last:mb-0">{children}</ol>,
  li: ({ children }: any) => <li>{children}</li>,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: any) => <em>{children}</em>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-border pl-3 my-2 italic text-muted-foreground">{children}</blockquote>
  ),
  a: ({ children, href }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-primary">
      {children}
    </a>
  ),
  code: ({ children }: any) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  hr: () => <hr className="my-3 border-border" />,
};

const inlineComponents = {
  ...blockComponents,
  p: ({ children }: any) => <>{children}</>,
  h1: ({ children }: any) => <>{children}</>,
  h2: ({ children }: any) => <>{children}</>,
  h3: ({ children }: any) => <>{children}</>,
  ul: ({ children }: any) => <>{children}</>,
  ol: ({ children }: any) => <>{children}</>,
  li: ({ children }: any) => <>{children} </>,
};

export function MarkdownContent({ content, className, inline }: MarkdownContentProps) {
  if (inline) {
    return (
      <span className={className}>
        <ReactMarkdown components={inlineComponents}>{content}</ReactMarkdown>
      </span>
    );
  }

  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      <ReactMarkdown components={blockComponents}>{content}</ReactMarkdown>
    </div>
  );
}
