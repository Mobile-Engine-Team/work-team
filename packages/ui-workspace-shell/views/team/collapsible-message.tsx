import { useId, useLayoutEffect, useRef, useState } from "react";
import { TeamMarkdown } from "./markdown";
import { text } from "./client";

export function CollapsibleMessage({
  content,
  previewHeight = 320,
  expandLabel = "expandMessage",
  images = true,
}: {
  content: string;
  previewHeight?: number;
  expandLabel?: string;
  images?: boolean;
}) {
  const id = useId();
  const body = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  useLayoutEffect(() => {
    const element = body.current;
    if (!element) return;
    const measure = () => setOverflow(element.scrollHeight > previewHeight + 2);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, [content, previewHeight]);
  return (
    <div>
      <div
        id={id}
        ref={body}
        className="team-message-body"
        data-expanded={expanded}
        style={{ maxHeight: expanded ? "none" : previewHeight }}
      >
        <TeamMarkdown content={content} images={images} />
      </div>
      {overflow && (
        <button
          className="team-text-action team-message-toggle"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
        >
          {text(expanded ? "collapseMessage" : expandLabel)}
        </button>
      )}
    </div>
  );
}
