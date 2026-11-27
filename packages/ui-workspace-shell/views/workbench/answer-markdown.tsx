import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

/** Text only: model output cannot load images, navigate, execute HTML or code. */
export function AnswerMarkdown({ content }: { content: string }) {
  return <div className="a2-prose"><ReactMarkdown
    remarkPlugins={[remarkGfm, remarkBreaks]}
    skipHtml
    components={{
      a: ({ children }) => <span>{children}</span>,
      img: ({ alt }) => <span>{alt}</span>,
    }}
  >{content}</ReactMarkdown></div>;
}
