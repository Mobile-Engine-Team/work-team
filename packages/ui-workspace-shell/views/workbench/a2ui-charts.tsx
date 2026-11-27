import { useContext } from "react";
import { useStore } from "zustand";
import { BarChart3, Table2 } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { text } from "../team/client";
import { currentLocale } from "@/i18n";
import {
  distributionMax,
  groupColor,
  isStatusField,
  orderGroups,
  orderSeries,
  seriesColor,
  type Distribution,
  type DistributionGroup,
} from "./a2ui-distribution";
import {
  AnswerUiScopeContext,
  EntityButton,
  Sources,
  boundRecord,
  displayValue,
  fieldLabel,
  statusLabel,
  useAnswerUiStore,
  type Context,
} from "./a2ui-ui";

const num = (n: number) => n.toLocaleString(currentLocale());
const numeric = (v: unknown) =>
  typeof v === "number" || (typeof v === "string" && /^[\d.,%+-]+$/.test(v));

/** A bound value: opens its record when the binding addresses one. */
function BoundValue({
  value,
  raw,
  context,
}: {
  value: unknown;
  raw: unknown;
  context: Context;
}) {
  const record = boundRecord(raw);
  const label = displayValue(value, record?.field);
  return record ? (
    <EntityButton id={record.id} context={context}>
      {label}
    </EntityButton>
  ) : (
    <>{label}</>
  );
}

export function KeyFacts({
  items,
  raw,
  context,
}: {
  items: { label: string; value: unknown }[];
  raw: unknown;
  context: Context;
}) {
  const rawItems = Array.isArray(raw) ? raw : [];
  return (
    <dl className="a2-facts">
      {items.map((item, i) => {
        const rawValue: unknown =
          rawItems[i] && typeof rawItems[i] === "object"
            ? Reflect.get(rawItems[i], "value")
            : undefined;
        return (
          <div key={i} data-numeric={numeric(item.value)}>
            <dt>{item.label}</dt>
            <dd>
              <BoundValue value={item.value} raw={rawValue} context={context} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function Stat({
  label,
  value,
  raw,
  tone = "neutral",
  caption,
  context,
}: {
  label: string;
  value: unknown;
  raw: unknown;
  tone?: string;
  caption?: string;
  context: Context;
}) {
  return (
    <div className="a2-stat" data-tone={tone} data-numeric={numeric(value)}>
      <span className="a2-stat-label">{label}</span>
      <strong className="a2-stat-value">
        <BoundValue value={value} raw={raw} context={context} />
      </strong>
      {caption && <span className="a2-stat-caption">{caption}</span>}
    </div>
  );
}

function groupLabel(d: Distribution, g: DistributionGroup) {
  if (g.key === "") return displayValue(null, d.field);
  return isStatusField(d.field) ? statusLabel(g.key) : g.label;
}
function seriesLabel(d: Distribution, s: string) {
  if (!d.seriesField) return text("wb.dist.count");
  return displayValue(s, d.seriesField);
}
/** Plain-language reading of one group, used as its accessible name. */
function describeGroup(
  d: Distribution,
  g: DistributionGroup,
  series = orderSeries(d),
) {
  const parts = d.seriesField
    ? series
        .filter((s) => g.values[s] > 0)
        .map((s) => `${seriesLabel(d, s)} ${num(g.values[s])}`)
    : [];
  return [
    `${groupLabel(d, g)}: ${text("wb.dist.total")} ${num(g.total)}`,
    ...parts,
  ].join(", ");
}

function GroupName({
  d,
  g,
  context,
}: {
  d: Distribution;
  g: DistributionGroup;
  context: Context;
}) {
  const label = groupLabel(d, g);
  return g.recordId ? (
    <EntityButton id={g.recordId} context={context} className="a2-dist-name">
      {label}
    </EntityButton>
  ) : (
    <span className="a2-dist-name" data-unset={g.key === ""}>
      {label}
    </span>
  );
}

function Bars({ d, context }: { d: Distribution; context: Context }) {
  const series = orderSeries(d);
  const max = distributionMax(d);
  return (
    <ul className="a2-bars">
      {orderGroups(d).map((g) => (
        <li key={g.key} className="a2-bar-row">
          <GroupName d={d} g={g} context={context} />
          <span
            className="a2-bar-track"
            role="img"
            aria-label={describeGroup(d, g, series)}
          >
            <span
              className="a2-bar"
              style={{ width: max ? `${(g.total / max) * 100}%` : 0 }}
            >
              {series
                .filter((s) => g.values[s] > 0)
                .map((s) => (
                  <span
                    key={s}
                    className="a2-seg"
                    data-color={d.seriesField ? seriesColor(d, s) : groupColor(d, g.key)}
                    style={{ flexGrow: g.values[s] }}
                    title={`${seriesLabel(d, s)} ${num(g.values[s])}`}
                  />
                ))}
            </span>
          </span>
          <span className="a2-bar-total">{num(g.total)}</span>
        </li>
      ))}
    </ul>
  );
}

function Breakdown({ d, context }: { d: Distribution; context: Context }) {
  const series = d.seriesField ? orderSeries(d) : [];
  return (
    <Table className="a2-table a2-dist-table">
      <TableHeader>
        <TableRow>
          <TableHead>{groupHeading(d.field)}</TableHead>
          {series.map((s) => (
            <TableHead key={s} data-numeric>
              <span className="a2-swatch" data-color={seriesColor(d, s)} />
              {seriesLabel(d, s)}
            </TableHead>
          ))}
          <TableHead data-numeric>{text("wb.dist.total")}</TableHead>
          <TableHead>
            <span className="a2-sr">{text("wb.evidence")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orderGroups(d).map((g) => (
          <TableRow key={g.key}>
            <TableCell>
              <GroupName d={d} g={g} context={context} />
            </TableCell>
            {series.map((s) => (
              <TableCell key={s} data-numeric data-zero={g.values[s] === 0}>
                {num(g.values[s])}
              </TableCell>
            ))}
            <TableCell data-numeric className="a2-dist-sum">
              {num(g.total)}
            </TableCell>
            <TableCell>
              <Sources ids={g.evidenceIds} context={context} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
const groupHeading = (field: string) =>
  fieldLabel(field) === field ? text("wb.dist.group") : fieldLabel(field);

export function DistributionView({
  componentId,
  title,
  data,
  variant = "bars",
  context,
}: {
  componentId: string;
  title: string;
  data: Distribution;
  variant?: string;
  context: Context;
}) {
  const store = useAnswerUiStore();
  const scope = useContext(AnswerUiScopeContext);
  const key = `${scope}:${componentId}`;
  const view = useStore(store, (s) => s.views[key] || variant);
  const series = orderSeries(data);
  const empty = data.groups.length === 0;
  const views = [
    { id: "bars", label: text("wb.dist.chart"), Icon: BarChart3 },
    { id: "table", label: text("wb.dist.table"), Icon: Table2 },
  ];
  return (
    <figure className="a2-dist" data-view={view}>
      <figcaption className="a2-dist-head">
        <h5>{title}</h5>
        {!empty && (
          <span
            className="a2-segmented"
            role="group"
            aria-label={text("wb.dist.view")}
          >
            {views.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => store.getState().setView(key, id)}
              >
                <Icon size={13} aria-hidden />
                {label}
              </button>
            ))}
          </span>
        )}
      </figcaption>
      {empty ? (
        <p className="a2-empty">{text("wb.dist.empty")}</p>
      ) : view === "table" ? (
        <Breakdown d={data} context={context} />
      ) : (
        <>
          {data.seriesField && (
            <ul className="a2-legend">
              {series.map((s) => (
                <li key={s}>
                  <span className="a2-swatch" data-color={seriesColor(data, s)} />
                  {seriesLabel(data, s)}
                </li>
              ))}
            </ul>
          )}
          <Bars d={data} context={context} />
        </>
      )}
    </figure>
  );
}
