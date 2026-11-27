import type { ReactNode } from "react";

export function Progress({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <span className="team-progress" role="status">
      {active && <span className="team-progress-spinner" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}
