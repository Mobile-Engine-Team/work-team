import { AnswerSurface } from "./a2ui-runtime";
import { A2UI_SDK, isProseAnswer } from "./a2ui-contract";
import { AnswerUiContext, createAnswerUiStore } from "./a2ui-ui";
import "./a2ui.css";
import { ArrowUpRight, FileText, LayoutDashboard, MessageSquare, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Profiler,
  useEffect,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { text } from "../team/client";
import type { Evidence, Result } from "./schemas";
import {
  type DynamicAnswer,
  type DynamicSection,
  type TreeNode,
} from "./dynamic-contract";
import { runLayout } from "./dynamic-runner";
import "./dynamic.css";
function fieldLabel(field: string) {
  const value = text(`wb.field.${field}`);
  return value === `team.wb.field.${field}` ? field : value;
}
function display(value: unknown, field = ""): string {
  if (value === null || value === undefined) return text("wb.unset");
  if (typeof value === "object")
    return Object.entries(value)
      .map(([k, v]) => `${display(k, field)}: ${display(v)}`)
      .join(" · ");
  if (
    field === "status" ||
    field === "issueStatus" ||
    field === "dependsOnStatus"
  ) {
    const label = text(`wb.state.${String(value)}`);
    return label === `team.wb.state.${String(value)}` ? String(value) : label;
  }
  if (field === "acceptanceCriteria" && value === "[]") return text("wb.unset");
  return String(value);
}
export type LayoutStateChange = (
  sectionId: string,
  state: Record<string, unknown>,
) => void;
type Context = {
  answer: DynamicAnswer;
  section: DynamicSection;
  evidence: Evidence[];
  onEvidence: (e: Evidence) => void;
  onFollowUp: (s: string) => void;
  state: Record<string, unknown>;
  setState: (key: string, value: unknown) => void;
};
function EvidenceButton({
  id,
  context,
  inline = false,
}: {
  id: string;
  context: Context;
  inline?: boolean;
}) {
  const e = context.evidence.find((e) => e.id === id);
  return e ? (
    <button
      className={inline ? "wb-bound-link" : "wb-evidence-link"}
      onClick={() => context.onEvidence(e)}
    >
      {e.title || text("wb.evidence")}
    </button>
  ) : null;
}
function ClaimSources({ ids, context }: { ids: string[]; context: Context }) {
  const [open, setOpen] = useState(false);
  if (!ids.length) return null;
  return (
    <span className="wb-claim-sources">
      <button
        className="wb-source-toggle"
        aria-expanded={open}
        aria-label={`${text("wb.evidence")} · ${ids.length}`}
        onClick={() => setOpen(!open)}
      >
        {text("wb.evidence")} {ids.length}
      </button>
      {open && (
        <span className="wb-source-list">
          {ids.map((id) => (
            <EvidenceButton key={id} id={id} context={context} inline />
          ))}
        </span>
      )}
    </span>
  );
}
function BoundValue({
  value,
  field,
  row,
  context,
  variant,
}: {
  value: unknown;
  field: string;
  row?: Record<string, unknown>;
  context: Context;
  variant?: TreeNode["props"]["variant"];
}) {
  const status = ["status", "issueStatus", "dependsOnStatus"].includes(field);
  const missing =
    value == null ||
    value === "" ||
    (field === "acceptanceCriteria" && value === "[]");
  const unresolved =
    missing &&
    ((field === "assigneeName" && row?.assigneeId) ||
      (field === "leadName" && row?.leadId));
  const statusTones: Record<string, string> = {
    in_progress: "accent",
    working: "accent",
    done: "positive",
    completed: "positive",
    current: "positive",
    blocked: "warning",
    in_review: "warning",
  };
  const tone = status ? statusTones[String(value)] || "muted" : "neutral";
  const e = context.evidence.find((e) => e.id === row?.id);
  const label =
    field === "projectId" && value
      ? context.evidence.find(
          (e) => e.kind === "project" && e.objectId === value,
        )?.title || text("wb.unresolved")
      : unresolved
        ? text("wb.unresolved")
        : display(value, field);
  const className = `wb-bound-value ${missing ? "wb-value-missing" : status || variant === "badge" ? `wb-value-badge wb-tone-${tone}` : ""}`;
  return e ? (
    <button
      className={className}
      title={`${fieldLabel(field)} · ${text("wb.evidence")}`}
      onClick={() => context.onEvidence(e)}
    >
      {label}
    </button>
  ) : (
    <span className={className}>{label}</span>
  );
}
function BoundClaim({
  id,
  context,
  compact = false,
  variant = "default",
}: {
  id: string;
  context: Context;
  compact?: boolean;
  variant?: TreeNode["props"]["variant"];
}) {
  const c = context.answer.claims[id];
  if (!c) return null;
  const refs = [
    ...new Set([
      ...(c.evidenceIds || []),
      ...(c.factIds || []).flatMap(
        (id) => context.answer.facts[id]?.evidenceIds || [],
      ),
    ]),
  ];
  if (compact)
    return (
      <a href={`#claim-${context.section.hash}-${id}`}>{c.text.slice(0, 60)}</a>
    );
  if (variant !== "default") {
    const body = (
      <>
        <span className="wb-claim-kind">{text(`wb.claim.${c.kind}`)}</span>
        <span className="wb-claim-text">{c.text}</span>
        <ClaimSources ids={refs} context={context} />
      </>
    );
    const className = `wb-claim-composed wb-claim-${variant} wb-claim-kind-${c.kind}`;
    const anchor = `claim-${context.section.hash}-${id}`;
    return variant === "inline" ? (
      <span className={className} id={anchor}>
        {body}
      </span>
    ) : (
      <div className={className} id={anchor}>
        {body}
      </div>
    );
  }
  return (
    <article
      className={`wb-claim wb-claim-${c.kind}`}
      id={`claim-${context.section.hash}-${id}`}
    >
      <small>{text(`wb.claim.${c.kind}`)}</small>
      <p>{c.text}</p>
      {refs.length > 0 && (
        <details>
          <summary>
            {text("wb.evidence")} · {refs.length}
          </summary>
          {refs.map((id) => (
            <EvidenceButton key={id} id={id} context={context} />
          ))}
        </details>
      )}
    </article>
  );
}
function BoundData({ node, context }: { node: TreeNode; context: Context }) {
  const [sort, setSort] = useState<{
    field: string;
    descending: boolean;
  } | null>(null);
  const ds = context.answer.datasets[node.props.datasetId || ""];
  if (!ds) return null;
  const fields = node.props.fields || [];
  let rows = node.props.rowIds
    ? node.props.rowIds
        .map((id) => ds.rows.find((row) => row.id === id))
        .filter((row) => row !== undefined)
    : ds.rows;
  if (sort)
    rows = [...rows].sort(
      (a, b) =>
        display(a[sort.field]).localeCompare(
          display(b[sort.field]),
          undefined,
          { numeric: true },
        ) * (sort.descending ? -1 : 1),
    );
  const limited = rows.length > 80;
  rows = rows.slice(0, 80);
  const label = node.props.label;
  const compact = node.props.variant === "compact";
  if (rows.length === 0) return <p className="wb-dim">{text("wb.noRows")}</p>;
  return (
    <div className={`wb-data wb-data-${node.type.toLowerCase()}`}>
      {label && <h4>{label}</h4>}
      {node.type === "Table" ? (
        <div className="wb-table-scroll">
          <table>
            <thead>
              <tr>
                {fields.map((field) => (
                  <th key={field}>
                    <button
                      onClick={() =>
                        setSort({
                          field,
                          descending: sort?.field === field && !sort.descending,
                        })
                      }
                    >
                      {fieldLabel(field)}
                      {sort?.field === field
                        ? sort.descending
                          ? " ↓"
                          : " ↑"
                        : ""}
                    </button>
                  </th>
                ))}
                {!compact && <th>{text("wb.evidence")}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={String(row.id || i)}>
                  {fields.map((field) => (
                    <td
                      key={field}
                      className={field === "status" ? "wb-status-value" : ""}
                    >
                      {compact ? (
                        <BoundValue
                          value={row[field]}
                          field={field}
                          row={row}
                          context={context}
                        />
                      ) : field === "projectId" ? (
                        context.evidence.find(
                          (e) =>
                            e.kind === "project" && e.objectId === row[field],
                        )?.title || text("wb.unresolved")
                      ) : (
                        display(row[field], field)
                      )}
                    </td>
                  ))}
                  {!compact && (
                    <td>
                      <EvidenceButton id={String(row.id)} context={context} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ol>
          {rows.map((row, i) => (
            <li key={String(row.id || i)}>
              {fields.map((field, j) =>
                j === 0 ? (
                  <strong key={field}>{display(row[field], field)}</strong>
                ) : (
                  <p key={field}>
                    <span className="wb-dim">{fieldLabel(field)} · </span>
                    {display(row[field], field)}
                  </p>
                ),
              )}
              <EvidenceButton id={String(row.id)} context={context} />
            </li>
          ))}
        </ol>
      )}
      {(!ds.complete || limited) && (
        <small className="wb-dim">{text("wb.partialDataset")}</small>
      )}
    </div>
  );
}
function RenderNode({
  node,
  context,
}: {
  node: TreeNode;
  context: Context;
}): ReactNode {
  const p = node.props;
  const children = node.children.map((c, i) =>
    typeof c === "string" ? (
      c
    ) : (
      <RenderNode key={i} node={c} context={context} />
    ),
  );
  switch (node.type) {
    case "Brief":
      return <Card variant="outline" className="wb-catalog-brief"><div className="wb-brief-mark"><LayoutDashboard size={21} /></div><div className="wb-brief-body">{p.label && <div className="wb-eyebrow">{p.label}</div>}<BoundClaim id={p.id || ""} context={context} variant="headline" />{children.length > 0 && <div className="wb-brief-meta">{children}</div>}</div></Card>;
    case "Panel":
      return <Card variant="outline" className={`wb-catalog-panel wb-panel-${p.tone || "neutral"}`}><CardHeader><CardTitle>{p.label}</CardTitle>{p.description && <CardDescription>{p.description}</CardDescription>}</CardHeader><CardContent>{children}</CardContent></Card>;
    case "Split":
      return <div className="wb-catalog-split">{children}</div>;
    case "Comparison":
      return <div className="wb-comparison"><div className="wb-comparison-head"><span>{text("wb.catalog.item")}</span><span>{text("wb.field.status")}</span><span>{text("wb.field.assigneeName")}</span><span /></div>{children}</div>;
    case "Record": {
      const row = context.answer.datasets[p.datasetId || ""]?.rows.find((r) => r.id === p.rowId);
      if (!row) return null;
      return <div className="wb-record"><div className="wb-record-name"><span className="wb-record-icon"><FileText size={17} /></span><strong>{display(row.title)}</strong></div><BoundValue field="status" value={row.status} row={row} context={context} /><span className="wb-person">{row.assigneeName && <span className="wb-avatar">{String(row.assigneeName).slice(0, 1).toUpperCase()}</span>}<BoundValue field="assigneeName" value={row.assigneeName} row={row} context={context} /></span><button className="wb-record-open" aria-label={`${text("wb.evidence")} · ${display(row.title)}`} onClick={() => { const evidence = context.evidence.find((e) => e.id === row.id); if (evidence) context.onEvidence(evidence); }}><ArrowUpRight size={16} /></button></div>;
    }
    case "CheckItem":
      return <div className="wb-check-item"><span className="wb-check-marker"><Info size={15} /></span><div>{p.label && <h4>{p.label}</h4>}<BoundClaim id={p.id || ""} context={context} variant="compact" /></div></div>;
    case "Feedback": {
      const dataset = context.answer.datasets[p.datasetId || ""];
      if (!dataset) return null;
      const rows = p.rowIds ? dataset.rows.filter((r) => p.rowIds?.includes(String(r.id))) : dataset.rows;
      return <div className="wb-feedback">{rows.length === 0 && <p>{text("wb.noRows")}</p>}{rows.slice(0, 8).map((row) => <article key={String(row.id)}><span className="wb-avatar"><MessageSquare size={14} /></span><div><div className="wb-feedback-meta"><strong>{display(row.authorName)}</strong><span>{text("wb.claim.statement")}</span><time>{new Date(String(row.updatedAt)).toLocaleString()}</time></div><blockquote>{display(row.content ?? row.text)}</blockquote><EvidenceButton id={String(row.id)} context={context} inline /></div></article>)}{(!dataset.complete || rows.length > 8) && <small>{text("wb.partialDataset")}</small>}</div>;
    }
    case "Box":
    case "Stack":
    case "Grid": {
      const style: CSSProperties = {
        gap: p.gap ?? 12,
        padding: p.padding ?? 0,
        display: node.type === "Grid" ? "grid" : "flex",
        gridTemplateColumns:
          node.type === "Grid"
            ? `repeat(${p.columns ?? 2},minmax(0,1fr))`
            : undefined,
        flexDirection: p.direction ?? "column",
        alignItems: p.align
          ? { start: "flex-start", center: "center", end: "flex-end" }[p.align]
          : undefined,
      };
      return (
        <div
          className={`wb-layout wb-tone-${p.tone || "neutral"} wb-surface-${p.surface || "plain"} ${node.type === "Grid" ? "wb-grid" : ""}`}
          style={style}
        >
          {children}
        </div>
      );
    }
    case "Divider":
      return <hr />;
    case "Heading":
      return (
        <h4
          className={`wb-tone-${p.tone || "neutral"} wb-size-${p.size || "normal"}`}
        >
          {children}
        </h4>
      );
    case "Text":
      return (
        <p
          className={`wb-tone-${p.tone || "neutral"} wb-size-${p.size || "normal"}`}
        >
          {children}
        </p>
      );
    case "Badge":
      return (
        <span
          className={`wb-badge wb-tone-${p.tone || "neutral"} wb-size-${p.size || "small"}`}
        >
          {children}
        </span>
      );
    case "Claim":
    case "ClaimRef":
      return (
        <BoundClaim
          id={p.id || ""}
          context={context}
          compact={node.type === "ClaimRef"}
          variant={p.variant}
        />
      );
    case "Fact": {
      const f = context.answer.facts[p.id || ""];
      if (!f) return null;
      if (p.variant === "inline" || p.variant === "value") {
        const row = context.answer.datasets[f.binding.datasetId]?.rows.find(
          (r) => r.id === f.binding.rowId,
        );
        return (
          <span className="wb-inline-fact">
            {p.label && <span className="wb-dim">{p.label} </span>}
            <BoundValue
              value={f.value}
              field={f.binding.field || ""}
              row={row}
              context={context}
            />
            {!f.complete && <small>{text("wb.partialDataset")}</small>}
          </span>
        );
      }
      return (
        <div className="wb-fact">
          {p.label && <small>{p.label}</small>}
          <strong>{display(f.value, f.binding.field)}</strong>
          {!f.complete && <small>{text("wb.partialDataset")}</small>}
        </div>
      );
    }
    case "Field": {
      const row = context.answer.datasets[p.datasetId || ""]?.rows.find(
        (r) => r.id === p.rowId,
      );
      if (p.variant && p.variant !== "default") {
        const value = (
          <>
            <span className="wb-field-label">{p.label}</span>
            <BoundValue
              value={row?.[p.field || ""]}
              field={p.field || ""}
              row={row}
              context={context}
              variant={p.variant}
            />
          </>
        );
        return p.variant === "inline" ? (
          <span className="wb-field-inline">{value}</span>
        ) : (
          <span className={`wb-field wb-field-${p.variant}`}>{value}</span>
        );
      }
      return (
        <span className="wb-field">
          <small className="wb-dim">
            {p.label || fieldLabel(p.field || "")}
          </small>
          <span>{display(row?.[p.field || ""], p.field)}</span>
        </span>
      );
    }
    case "Evidence":
    case "Entity":
      return (
        <EvidenceButton
          id={p.id || ""}
          context={context}
          inline={p.variant === "inline"}
        />
      );
    case "Table":
    case "List":
    case "Timeline":
      return <BoundData node={node} context={context} />;
    case "BarChart": {
      const value = context.answer.facts[p.factId || ""]?.value;
      if (!value || typeof value !== "object") return null;
      const entries = Object.entries(value);
      const max = Math.max(1, ...entries.map(([, v]) => v));
      return (
        <figure>
          <figcaption>{p.label}</figcaption>
          {entries.slice(0, 80).map(([label, n]) => (
            <div className="wb-bar" key={label}>
              <span>{display(label, "status")}</span>
              <meter min={0} max={max} value={n} />
              <b>{n}</b>
            </div>
          ))}
        </figure>
      );
    }
    case "Collapse":
      return (
        <details className="wb-collapse">
          <summary>{p.label || text("wb.details")}</summary>
          {children}
        </details>
      );
    case "Tabs":
    case "Select":
    case "Filter":
    case "Toggle": {
      const key = p.stateKey || "";
      const spec = context.section.state[key];
      if (!spec) return null;
      if (node.type === "Tabs" || node.type === "Toggle")
        return (
          <div className="wb-tabs" role="group" aria-label={p.label}>
            {spec.values.map((value, index) => (
              <button
                key={index}
                aria-pressed={context.state[key] === value}
                onClick={() => context.setState(key, value)}
              >
                {display(value)}
              </button>
            ))}
          </div>
        );
      return (
        <label className="wb-select">
          {p.label}
          <select
            value={spec.values.findIndex((v) => v === context.state[key])}
            onChange={(e) =>
              context.setState(key, spec.values[Number(e.target.value)])
            }
          >
            {spec.values.map((value, index) => (
              <option key={index} value={index}>
                {display(value)}
              </option>
            ))}
          </select>
        </label>
      );
    }
    case "Action":
      return (
        <button
          className="wb-dynamic-action"
          onClick={() => {
            if (p.kind === "followUp") context.onFollowUp(p.value || "");
            else {
              const e = context.evidence.find((e) => e.id === p.value);
              if (e) context.onEvidence(e);
            }
          }}
        >
          {p.label}
        </button>
      );
  }
}
function Region({
  answer,
  section,
  id,
  evidence,
  onEvidence,
  onFollowUp,
  asOf,
  generating,
  onStateChange,
}: {
  answer: DynamicAnswer;
  section?: DynamicSection;
  id: string;
  evidence: Evidence[];
  onEvidence: Context["onEvidence"];
  onFollowUp: Context["onFollowUp"];
  asOf: string;
  generating: boolean;
  onStateChange?: LayoutStateChange;
}) {
  const [state, setState] = useState<Record<string, unknown>>({});
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [failed, setFailed] = useState(false);
  const hash = section?.hash;
  useEffect(() => {
    onStateChange?.(id, state);
  }, [state]);
  useEffect(() => {
    setState(
      Object.fromEntries(
        Object.entries(section?.state || {}).map(([k, v]) => [k, v.default]),
      ),
    );
  }, [hash]);
  useEffect(() => {
    if (!section) {
      setTree(null);
      return;
    }
    const controller = new AbortController();
    setFailed(false);
    const localState = {
      ...Object.fromEntries(
        Object.entries(section.state).map(([k, v]) => [k, v.default]),
      ),
      ...state,
    };
    void runLayout(
      answer,
      section,
      localState,
      asOf,
      evidence.map((e) => e.id),
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setTree(result.tree);
          performance.measure("workbench-layout", {
            start: performance.now() - result.totalMs,
            detail: { ...result, tree: undefined },
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTree(null);
          setFailed(true);
        }
      });
    return () => controller.abort();
  }, [hash, section?.revision, state, answer.datasets, answer.claims, answer.facts]);
  const fallbackSection: DynamicSection = section || {
    id,
    revision: 0,
    code: "",
    js: "",
    hash: id,
    sdk: "",
    runtime: "",
    state: {},
    contentRefs: [],
    dataRefs: [],
    compileMs: 0,
  };
  const context: Context = {
    answer,
    section: fallbackSection,
    evidence,
    onEvidence,
    onFollowUp,
    state,
    setState: (key, value) => setState((prev) => ({ ...prev, [key]: value })),
  };
  const content = answer.contents[id];
  const ids =
    section?.contentRefs ||
    Object.values(answer.claims)
      .filter((c) =>
        content?.claims?.some(
          (raw) =>
            raw && typeof raw === "object" && "id" in raw && raw.id === c.id,
        ),
      )
      .map((c) => c.id);
  return (
    <div
      className="wb-dynamic-region"
      data-region={id}
      data-render={tree ? "dynamic" : failed ? "fallback" : "content"}
    >
      {failed && (
        <small className="wb-fallback" role="status">
          {text("wb.layoutFallback")}
        </small>
      )}
      {tree ? (
        <RenderNode node={tree} context={context} />
      ) : (
        <div className="wb-layout">
          {(failed || !generating ? ids : ids.slice(0, 1)).map((id) => (
            <BoundClaim key={id} id={id} context={context} variant="compact" />
          ))}
          {!failed && generating && (
            <div className="wb-region-building" role="status">
              <span className="wb-building-dot" />
              {text("wb.assemblingView")}
              <span className="wb-building-lines" aria-hidden="true">
                <i />
                <i />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export function DynamicView({
  result,
  generating = false,
  onEvidence,
  onEntity,
  onFollowUp,
  onStateChange,
}: {
  result: Result;
  generating?: boolean;
  onEvidence: Context["onEvidence"];
  onEntity: Context["onEvidence"];
  onFollowUp: Context["onFollowUp"];
  onStateChange?: LayoutStateChange;
}) {
  const [uiStore] = useState(createAnswerUiStore);
  const answer = result.dynamic;
  if (!answer?.plan) return null;
  const prose = isProseAnswer(answer);
  return (
    <AnswerUiContext.Provider value={uiStore}><Profiler
      id="workbench-answer"
      onRender={(_id, phase, actualDuration, _base, startTime, commitTime) => {
        performance.measure("workbench-react", {
          start: startTime,
          end: commitTime,
          detail: { phase, actualDuration },
        });
      }}
    >
      <div className={`wb-result wb-dynamic ${prose ? "wb-chat-answer" : ""} ${Object.values(answer.sections).some((s) => s.sdk === A2UI_SDK) ? "wb-a2ui" : Object.values(answer.sections).some((s) => s.surface) ? "wb-catalog-answer" : ""}`} data-theme="neutral">
        {!prose && <header>
          <h2>{answer.plan.title}</h2>
          <small>
            {text("wb.snapshot")} ·{" "}
            {new Date(result.generatedAt).toLocaleString()} · {result.model}
          </small>
          {result.stale && <p className="wb-fallback">{text("wb.stale")}</p>}
        </header>}
        <div className={`wb-regions wb-regions-${answer.plan.layout}`}>
          {answer.plan.sections.filter((region) => generating || answer.sections[region.id]).map((region) => (
            <section
              key={region.id}
              className={`wb-region wb-role-${region.role} wb-region-${region.surface || "card"}`}
            >
              {region.title && <h3>{region.title}</h3>}
              {answer.sections[region.id]?.sdk === A2UI_SDK ? <AnswerSurface
                answer={answer} section={answer.sections[region.id]}
                onAction={(action) => {
                  if (action.name !== "showEvidence" && action.name !== "openEntity") return;
                  const evidence = result.evidence.find((e) => e.id === action.context.id);
                  if (evidence) (action.name === "openEntity" ? onEntity : onEvidence)(evidence);
                }}
              /> : <Region
                key={answer.sections[region.id]?.hash || region.id}
                answer={answer}
                generating={generating}
                section={answer.sections[region.id]}
                id={region.id}
                evidence={result.evidence}
                onEvidence={onEvidence}
                onFollowUp={onFollowUp}
                onStateChange={onStateChange}
                asOf={result.generatedAt}
              />}
            </section>
          ))}
        </div>
        {answer.limitations.length > 0 && (
          <aside className="wb-limitations">
            <strong>{text("wb.limitations")}</strong>
            {answer.limitations.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
          </aside>
        )}
        {answer.complete && (
          <div className="wb-followups">
            {answer.followUps.map((s, i) => (
              <button key={i} onClick={() => onFollowUp(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </Profiler></AnswerUiContext.Provider>
  );
}
