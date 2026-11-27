import { createContext, useContext, type ReactNode } from "react";

export interface PageAssembly {
  entries: ReadonlySet<string>;
  renderPage(key: string, props: { issueId?: string; onOpen: (id: string, comment?: string) => void }): ReactNode;
}

export const Pages = createContext<PageAssembly | null>(null);
export function usePageAssembly() {
  const assembly = useContext(Pages);
  if (!assembly) throw new Error("Missing DSH page assembly");
  return assembly;
}
