import type { ReactNode } from "react";
import type { Result } from "./schemas";

export function hasAnswerBody(result: Result | null): boolean {
  if (!result) return false;
  if (!result.dynamic) return result.view.blocks.length > 0;
  return !!result.dynamic.plan?.sections.some((s) => result.dynamic?.sections[s.id]);
}

export function AnswerOutcome({ failed, hasBody, notice, retryLabel, onRetry, retryDisabled, children }: {
  failed: boolean; hasBody: boolean; notice: string; retryLabel: string;
  onRetry: () => void; retryDisabled: boolean; children: ReactNode;
}) {
  return <>
    {failed && <div className="wb-answer-failure" role="alert">
      <p>{notice}</p>
      <button type="button" disabled={retryDisabled} onClick={onRetry}>{retryLabel}</button>
    </div>}
    {(!failed || hasBody) && children}
  </>;
}
