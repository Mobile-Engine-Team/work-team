import { createContext, useContext, type ReactNode } from "react";
import { createStore, useStore } from "zustand";
import { z } from "zod";
import type { ReactA2uiComponentProps } from "@a2ui/react";
import { ArrowUpRight, FileSearch } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { text } from "../team/client";
import { currentLocale } from "@/i18n";
import { statusTone } from "./a2ui-distribution";

const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const rowSchema = z.record(z.string(), scalar);
export type Row = z.infer<typeof rowSchema>;
export type RendererProps = ReactA2uiComponentProps<unknown>;
export type Context = RendererProps["context"];

export function createAnswerUiStore() {
  return createStore<{
    expanded: Record<string, boolean>;
    filters: Record<string, string>;
    views: Record<string, string>;
    setFilter: (id: string, value: string) => void;
    setView: (id: string, value: string) => void;
    toggle: (id: string) => void;
  }>((set) => ({
    expanded: {},
    filters: {},
    views: {},
    setFilter: (id, value) =>
      set((s) => ({ filters: { ...s.filters, [id]: value } })),
    setView: (id, value) => set((s) => ({ views: { ...s.views, [id]: value } })),
    toggle: (id) =>
      set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
  }));
}
export const AnswerUiScopeContext = createContext("");
export const AnswerUiContext = createContext<ReturnType<
  typeof createAnswerUiStore
> | null>(null);
export const AnswerMetricsContext = createContext<
  ((id: string, mounted: boolean) => void) | null
>(null);
export function useAnswerUiStore() {
  const store = useContext(AnswerUiContext);
  if (!store) throw Error("answer_ui_store_missing");
  return store;
}
export function useExpanded(id: string) {
  const store = useAnswerUiStore();
  const open = useStore(store, (s) => Boolean(s.expanded[id]));
  return { open, toggle: () => store.getState().toggle(id) };
}

export function fieldLabel(field: string) {
  const label = text(`wb.field.${field}`);
  return label.startsWith("team.wb.field.") ? field : label;
}
export const PERSON_FIELDS = ["assigneeName", "leadName", "authorName"];
const PERSON_ID: Record<string, string> = {
  assigneeName: "assigneeId",
  leadName: "leadId",
  authorName: "authorId",
};
export const isPersonField = (field: string) =>
  /^(assignee|lead|author|owner)/i.test(field);
export function statusLabel(value: unknown) {
  const label = text(`wb.state.${String(value)}`);
  return label.startsWith("team.wb.state.") ? String(value) : label;
}
export function displayValue(value: unknown, field = ""): string {
  if (value === undefined) return text("wb.notSupplied");
  if (value === null || value === "")
    return isPersonField(field) ? text("unassigned") : text("wb.unset");
  if (field.toLowerCase().includes("status")) return statusLabel(value);
  if (field === "updatedAt" || field === "dueDate" || field === "startDate") {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime()))
      return date.toLocaleString(currentLocale(), {
        year: "numeric",
        month: "short",
        day: "numeric",
        ...(field === "updatedAt"
          ? { hour: "2-digit", minute: "2-digit" }
          : {}),
      });
  }
  if (typeof value === "number") return value.toLocaleString(currentLocale());
  if (typeof value === "object")
    return Object.entries(value)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(" · ");
  return String(value);
}
/** A person name that is null while its id exists was not resolved, not unset. */
export function recordValue(row: Row, field: string) {
  const identity = PERSON_ID[field] ? row[PERSON_ID[field]] : null;
  return row[field] == null && identity
    ? text("wb.unresolved")
    : displayValue(row[field], field);
}

export const openEntity = (context: Context, id: string) =>
  void context.dispatchAction({
    event: { name: "openEntity", context: { id } },
  });
export const showEvidence = (context: Context, id: string) =>
  void context.dispatchAction({
    event: { name: "showEvidence", context: { id } },
  });
/** Record id addressed by a trusted `/records/<ds>/<id>/<field>` binding. */
export function boundRecord(raw: unknown) {
  const parsed = z.object({ "@path": z.string() }).safeParse(raw);
  if (!parsed.success) return null;
  const parts = parsed.data["@path"].split("/");
  if (parts[1] !== "records" || parts.length !== 5) return null;
  const decode = (s: string) => s.replaceAll("~1", "/").replaceAll("~0", "~");
  return { id: decode(parts[3]), field: decode(parts[4]) };
}

export function EntityButton({
  id,
  context,
  children,
  className = "",
}: {
  id: string;
  context: Context;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`a2-entity ${className}`}
      onClick={() => openEntity(context, id)}
    >
      <span>{children}</span>
      <ArrowUpRight size={12} aria-hidden />
    </button>
  );
}

export function Status({ value }: { value: unknown }) {
  return (
    <span
      className="a2-status"
      data-tone={statusTone(value)}
      data-status={String(value)}
    >
      <i aria-hidden />
      {displayValue(value, "status")}
    </span>
  );
}

function initial(name: string) {
  return Array.from(name.trim())[0]?.toUpperCase() || "?";
}
/** Initial avatar + name; unset and unresolved names stay visibly distinct. */
export function Person({ row, field }: { row: Row; field: string }) {
  const name = row[field];
  const label = recordValue(row, field);
  const known = typeof name === "string" && name.trim() !== "";
  return (
    <span className="a2-person" data-known={known}>
      <Avatar size="sm" className="a2-avatar" aria-hidden>
        <AvatarFallback>{known ? initial(name) : "–"}</AvatarFallback>
      </Avatar>
      <span>{label}</span>
    </span>
  );
}

/** One compact evidence entry: a count chip that expands to numbered links. */
export function Sources({ ids, context }: { ids: string[]; context: Context }) {
  const scope = useContext(AnswerUiScopeContext);
  const { open, toggle } = useExpanded(`sources:${scope}:${ids.join("|")}`);
  if (!ids.length) return null;
  return (
    <span className="a2-sources" data-open={open}>
      <button
        type="button"
        className="a2-sources-toggle"
        onClick={toggle}
        aria-expanded={open}
      >
        <FileSearch size={12} aria-hidden />
        {text("wb.evidence")}
        <b>{ids.length}</b>
      </button>
      {open &&
        ids.map((id, i) => (
          <button
            type="button"
            key={id}
            className="a2-source"
            aria-label={`${text("wb.evidence")} ${i + 1}`}
            onClick={() => showEvidence(context, id)}
          >
            {i + 1}
          </button>
        ))}
    </span>
  );
}
