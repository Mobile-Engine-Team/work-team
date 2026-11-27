import { useContext } from "react";
import { useStore } from "zustand";
import { ChevronDown, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { text } from "../team/client";
import {
  AnswerUiScopeContext,
  EntityButton,
  Person,
  PERSON_FIELDS,
  Sources,
  Status,
  displayValue,
  fieldLabel,
  recordValue,
  useAnswerUiStore,
  useExpanded,
  type Context,
  type Row,
} from "./a2ui-ui";

const PROSE = ["description", "content", "text"];
const VISIBLE = 6;
const isStatus = (field: string) => field.toLowerCase().endsWith("status");

function Cell({
  row,
  field,
  context,
}: {
  row: Row;
  field: string;
  context: Context;
}) {
  if (field === "title")
    return (
      <EntityButton id={String(row.id)} context={context}>
        {displayValue(row.title)}
      </EntityButton>
    );
  if (isStatus(field)) return <Status value={row[field]} />;
  if (PERSON_FIELDS.includes(field)) return <Person row={row} field={field} />;
  return <>{recordValue(row, field)}</>;
}

/** Compact two-line row: title + inline meta, person and status on the right. */
function RecordRow({
  row,
  fields,
  context,
}: {
  row: Row;
  fields: string[];
  context: Context;
}) {
  const id = String(row.id);
  const scope = useContext(AnswerUiScopeContext);
  const { open, toggle } = useExpanded(`record:${scope}:${id}`);
  const hasTitle = fields.includes("title");
  const person = fields.find((f) => PERSON_FIELDS.includes(f));
  const status = fields.find(isStatus);
  const meta = fields.filter(
    (f) => f !== "title" && f !== person && f !== status,
  );
  const prose = meta.filter((f) => PROSE.includes(f));
  const inline = meta.filter((f) => !PROSE.includes(f));
  const hidden = PROSE.find((f) => !fields.includes(f) && row[f]);
  return (
    <li className="a2-row" data-entity={id}>
      <div className="a2-row-main">
        {hasTitle && (
          <Cell row={row} field="title" context={context} />
        )}
        {inline.length > 0 && (
          <span className="a2-row-meta">
            {inline.map((f) => (
              <span key={f}>
                <span className="a2-meta-label">{fieldLabel(f)}</span>
                {recordValue(row, f)}
              </span>
            ))}
          </span>
        )}
        {prose.map((f) => (
          <p key={f} className="a2-row-prose">
            {recordValue(row, f)}
          </p>
        ))}
        {open && hidden && (
          <p className="a2-row-prose a2-original">{recordValue(row, hidden)}</p>
        )}
      </div>
      <div className="a2-row-side">
        {person && <Person row={row} field={person} />}
        {status && <Status value={row[status]} />}
        {hasTitle && hidden ? (
          <button
            type="button"
            className="a2-icon-button"
            aria-expanded={open}
            aria-label={`${text("wb.evidence")} · ${fieldLabel(hidden)}`}
            title={fieldLabel(hidden)}
            onClick={toggle}
          >
            <ChevronDown size={14} aria-hidden />
          </button>
        ) : (
          !hasTitle && <Sources ids={[id]} context={context} />
        )}
      </div>
    </li>
  );
}

function ComparisonRows({
  rows,
  fields,
  context,
}: {
  rows: Row[];
  fields: string[];
  context: Context;
}) {
  return (
    <Table className="a2-table">
      <TableHeader>
        <TableRow>
          {fields.map((f) => (
            <TableHead key={f} data-field={f}>
              {fieldLabel(f)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={String(r.id)} data-entity={String(r.id)}>
            {fields.map((f) => (
              <TableCell key={f} data-field={f}>
                <Cell row={r} field={f} context={context} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ActivityRows({
  rows,
  fields,
  context,
}: {
  rows: Row[];
  fields?: string[];
  context: Context;
}) {
  return (
    <ol className="a2-activity">
      {rows.map((r) => {
        const body = PROSE.find((f) => r[f] !== undefined);
        const shown = fields ?? [
          "authorName",
          "updatedAt",
          ...(body ? [body] : []),
        ];
        const person = shown.find((f) => PERSON_FIELDS.includes(f));
        const prose = shown.filter((f) => PROSE.includes(f));
        const meta = shown.filter((f) => f !== person && !prose.includes(f));
        return (
          <li key={String(r.id)} data-entity={String(r.id)}>
            <div className="a2-activity-head">
              {person ? (
                <Person row={r} field={person} />
              ) : (
                <MessageSquare size={14} aria-hidden />
              )}
              {meta.map((f) => (
                <span key={f} className="a2-activity-meta" data-field={f}>
                  {f === "title" || isStatus(f) ? (
                    <Cell row={r} field={f} context={context} />
                  ) : (
                    recordValue(r, f)
                  )}
                </span>
              ))}
              <Sources ids={[String(r.id)]} context={context} />
            </div>
            {prose.map((f) => (
              <p key={f} className="a2-activity-body">
                {recordValue(r, f)}
              </p>
            ))}
          </li>
        );
      })}
    </ol>
  );
}

export function Records({
  name,
  componentId,
  rows,
  fields: chosen,
  context,
}: {
  name: string;
  componentId: string;
  rows: Row[];
  fields?: string[];
  context: Context;
}) {
  const store = useAnswerUiStore();
  const scope = useContext(AnswerUiScopeContext);
  const key = `${scope}:${componentId}`;
  const filter = useStore(store, (s) => s.filters[key] || "");
  const { open, toggle } = useExpanded(`component:${key}`);
  const fields = chosen || [
    "title",
    "status",
    rows.some((r) => r.kind === "project") ? "leadName" : "assigneeName",
  ];
  const matching = rows.filter(
    (r) =>
      !filter ||
      Object.values(r).some((v) =>
        String(v).toLowerCase().includes(filter.toLowerCase()),
      ),
  );
  const shown = open ? matching : matching.slice(0, VISIBLE);
  return (
    <div className="a2-records" data-variant={name}>
      {rows.length > VISIBLE && (
        <Input
          className="a2-filter"
          aria-label={text("wb.filterRecords")}
          placeholder={text("wb.filterRecords")}
          value={filter}
          onChange={(e) => store.getState().setFilter(key, e.target.value)}
        />
      )}
      {name === "ComparisonTable" ? (
        <ComparisonRows rows={shown} fields={fields} context={context} />
      ) : name === "ActivityList" ? (
        <ActivityRows rows={shown} fields={chosen} context={context} />
      ) : (
        <ul className="a2-rows">
          {shown.map((r) => (
            <RecordRow
              key={String(r.id)}
              row={r}
              fields={fields}
              context={context}
            />
          ))}
        </ul>
      )}
      {matching.length > VISIBLE && (
        <button
          type="button"
          className="a2-more"
          aria-expanded={open}
          onClick={toggle}
        >
          {open
            ? text("wb.showLess")
            : `${text("wb.showAll")} (${matching.length})`}
          <ChevronDown size={13} aria-hidden />
        </button>
      )}
    </div>
  );
}
