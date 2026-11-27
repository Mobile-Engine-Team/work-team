import { useContext, useEffect, Fragment } from "react";
import { z } from "zod";
import { Catalog } from "@a2ui/web_core/catalog";
import { createComponentImplementation } from "@a2ui/react";
import { ChevronDown } from "lucide-react";
import { text } from "../team/client";
import { a2uiCatalog } from "./a2ui-contract";
import { distributionSchema } from "./a2ui-distribution";
import {
  AnswerMetricsContext,
  AnswerUiScopeContext,
  Sources,
  rowSchema,
  useExpanded,
  type Context,
  type RendererProps,
} from "./a2ui-ui";
import { AnswerMarkdown } from "./answer-markdown";
import { Records } from "./a2ui-records";
import { DistributionView, KeyFacts, Stat } from "./a2ui-charts";

const resolved = z.object({
  children: z.array(z.string()).optional(),
  title: z.string().optional(),
  ratio: z.string().optional(),
  columns: z.number().optional(),
  kind: z.string().optional(),
  text: z.string().optional(),
  body: z.string().optional(),
  evidenceIds: z.array(z.string()).optional(),
  factIds: z.array(z.string()).optional(),
  gapType: z.string().optional(),
  rows: z.array(rowSchema).optional(),
  rowIds: z.array(z.string()).optional(),
  fields: z.array(z.string()).optional(),
  items: z
    .array(z.object({ label: z.string(), value: z.unknown() }))
    .optional(),
  label: z.string().optional(),
  value: z.unknown(),
  tone: z.string().optional(),
  caption: z.string().optional(),
  data: distributionSchema.optional(),
  variant: z.string().optional(),
});
type Props = z.infer<typeof resolved>;

const LEAD_LIMIT = 140;
/** Splits a summary into its first sentence (the headline) and the rest. */
export function splitLead(value: string): [string, string] {
  const m = /^\s*([^\n]{4,140}?(?:[。！？]|[.!?](?=\s)))\s*/u.exec(value);
  if (m && m[0].length < value.length)
    return [m[1], value.slice(m[0].length)];
  return value.length <= LEAD_LIMIT ? [value.trim(), ""] : ["", value];
}
/** One numbered item per line; strips enumerators the model already wrote. */
export function questionItems(value: string) {
  const items = value
    .split(/\n+|(?<=[？?])\s*(?=\d+[.、)）]\s*)/u)
    .map((l) => l.replace(/^\s*(?:\d+[.、)）]|[-*•·])\s*/u, "").trim())
    .filter(Boolean);
  return items.length ? items : [value];
}

function KindLabel({ kind }: { kind?: string }) {
  if (!kind) return null;
  return (
    <span className="a2-kind" data-kind={kind}>
      {text(`wb.claim.${kind}`)}
    </span>
  );
}
function Analysis({
  name,
  p,
  context,
}: {
  name: string;
  p: Props;
  context: Context;
}) {
  const body = p.text || "";
  const sources = <Sources ids={p.evidenceIds || []} context={context} />;
  if (p.kind === "suggestion") return (
    <div className="a2-document">
      {p.title && <h4>{p.title}</h4>}
      <AnswerMarkdown content={body} />
      <div className="a2-document-sources"><KindLabel kind={p.kind} />{sources}</div>
    </div>
  );
  if (name === "AnswerSummary") {
    const [lead, rest] = splitLead(body);
    return (
      <div className="a2-summary" data-kind={p.kind}>
        <div className="a2-summary-head">
          <KindLabel kind={p.kind} />
          {p.title && <h4>{p.title}</h4>}
        </div>
        {lead && <p className="a2-lead">{lead}</p>}
        {rest && <p className="a2-dek">{rest}</p>}
        {sources}
      </div>
    );
  }
  if (name === "Questions")
    return (
      <div className="a2-questions-block">
        {p.title && <h5>{p.title}</h5>}
        <ol className="a2-questions">
          {questionItems(body).map((q, i) => (
            <li key={i}>
              <span>{q}</span>
            </li>
          ))}
        </ol>
        {sources}
      </div>
    );
  return (
    <div className={`a2-finding a2-${name.toLowerCase()}`} data-kind={p.kind}>
      <div className="a2-finding-head">
        <KindLabel kind={p.kind} />
        {p.title && <h5>{p.title}</h5>}
      </div>
      <p>
        {body}
        {sources}
      </p>
    </div>
  );
}

function Renderer({ name, ...input }: RendererProps & { name: string }) {
  const p = resolved.parse(input.props);
  const { context, buildChild } = input;
  const metrics = useContext(AnswerMetricsContext);
  const id = context.componentModel.id;
  useEffect(() => {
    metrics?.(id, true);
    return () => metrics?.(id, false);
  }, [metrics, id]);
  const scope = useContext(AnswerUiScopeContext);
  const { open, toggle } = useExpanded(`component:${scope}:${id}`);
  const raw = context.componentModel.properties;
  const children = p.children?.map((child) => (
    <Fragment key={child}>{buildChild(child)}</Fragment>
  ));
  switch (name) {
    case "Prose":
      return <AnswerMarkdown content={p.body || ""} />;
    case "Stack":
      return <div className="a2-stack">{children}</div>;
    case "Section":
      return (
        <section className="a2-section">
          {p.title && <h4>{p.title}</h4>}
          {children}
        </section>
      );
    case "Grid":
      return (
        <div className="a2-grid" data-columns={p.columns}>
          {children}
        </div>
      );
    case "Split":
      return (
        <div className="a2-split" data-ratio={p.ratio}>
          {children}
        </div>
      );
    case "Disclosure":
      return (
        <div className="a2-disclosure" data-open={open}>
          <button
            type="button"
            className="a2-more"
            aria-expanded={open}
            onClick={toggle}
          >
            {p.title}
            <ChevronDown size={13} aria-hidden />
          </button>
          {open && <div className="a2-disclosure-body">{children}</div>}
        </div>
      );
    case "KeyFacts":
      return (
        <KeyFacts
          items={p.items || []}
          raw={Reflect.get(raw, "items")}
          context={context}
        />
      );
    case "Stat":
      return (
        <Stat
          label={p.label || ""}
          value={p.value}
          raw={Reflect.get(raw, "value")}
          tone={p.tone}
          caption={p.caption}
          context={context}
        />
      );
    case "Distribution":
      if (!p.data) throw Error("distribution_data_missing");
      return (
        <DistributionView
          componentId={id}
          title={p.title || ""}
          data={p.data}
          variant={p.variant}
          context={context}
        />
      );
  }
  const byId = new Map(p.rows?.map((r) => [String(r.id), r]));
  const rows = p.rowIds
    ? p.rowIds.flatMap((rowId) => {
        const row = byId.get(rowId);
        return row ? [row] : [];
      })
    : p.rows || [];
  const analysis = p.text !== undefined && (
    <Analysis name={name} p={p} context={context} />
  );
  return (
    <div className={`a2-component a2-${name.toLowerCase()}-group`}>
      {analysis}
      {p.rows && (
        <>
          {!analysis && p.title && <h5>{p.title}</h5>}
          <Records
            name={name}
            componentId={id}
            rows={rows}
            fields={p.fields}
            context={context}
          />
        </>
      )}
    </div>
  );
}
export const reactAnswerCatalog = new Catalog(
  a2uiCatalog.id,
  "v1.0",
  [...a2uiCatalog.components.values()].map((api) =>
    createComponentImplementation(api, (props) => (
      <Renderer {...props} name={api.name} />
    )),
  ),
);
