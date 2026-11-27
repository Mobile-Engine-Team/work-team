import { displayProjectRequirements } from "./project-requirements";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly";
export function TeamMarkdown({
  content,
  images = true,
}: {
  content: string;
  images?: boolean;
}) {
  return (
    <div className="team-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCjkFriendly, remarkBreaks]}
        components={{
          ...(!images
            ? { img: ({ alt }: { alt?: string }) => <span>{alt}</span> }
            : {}),
          a: ({ href, children }) =>
            href?.startsWith("mention:") ? (
              <span className="team-mention">{children}</span>
            ) : (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ),
        }}
        urlTransform={(url) =>
          /^(https?:|mention:|mailto:)/.test(url) ? url : ""
        }
      >
        {displayProjectRequirements(content)}
      </ReactMarkdown>
    </div>
  );
}
