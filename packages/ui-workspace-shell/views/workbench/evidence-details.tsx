import { ExternalLink } from "lucide-react";
import { currentLocale } from "@/i18n";
import { text } from "../team/client";
import { Action } from "../team/ui";
import { CollapsibleMessage } from "../team/collapsible-message";
import type { Evidence } from "./schemas";
import { evidenceDestination, presentEvidence } from "./evidence-presentation";

function label(group: string, value: string) {
  const key = `wb.${group}.${value}`;
  const translated = text(key);
  return translated === `team.${key}`
    ? text(`wb.evidenceUnknown.${group}`)
    : translated;
}
function date(value: string, time = false) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? text("wb.notSupplied")
    : parsed.toLocaleString(currentLocale(), {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: time ? "2-digit" : undefined,
        minute: time ? "2-digit" : undefined,
      });
}
export function EvidenceDetails({
  evidence: e,
  onOpen,
}: {
  evidence: Evidence;
  onOpen: () => void;
}) {
  const presentation = presentEvidence(e),
    destination = evidenceDestination(e);
  return (
    <div className="wb-evidence">
      <p className="wb-evidence-snapshot">{text("wb.evidenceSnapshot")}</p>
      <h3>{e.title || label("source", e.kind)}</h3>
      <div className="wb-evidence-meta">
        <span>{label("source", e.kind)}</span>
        {e.status && <span>{label("state", e.status)}</span>}
        {(e.kind === "conclusion" || e.kind === "blueprint") &&
          /^\d+$/.test(e.version) && (
            <span>
              {text(
                e.kind === "conclusion"
                  ? "project.conclusionVersion"
                  : "wb.version",
              )}{" "}
              {e.version}
            </span>
          )}
        {e.updatedAt && (
          <time>
            {text(
              e.kind === "conclusion"
                ? "wb.evidenceField.confirmedAt"
                : "wb.evidenceField.updatedAt",
            )}{" "}
            · {date(e.updatedAt, true)}
          </time>
        )}
      </div>
      {!!presentation.fields.length && (
        <dl className="wb-evidence-fields">
          {presentation.fields.map((field, i) => (
            <div key={i}>
              <dt>{text(`wb.evidenceField.${field.label}`)}</dt>
              <dd>
                {field.format === "date"
                  ? date(field.value)
                  : field.format === "status"
                    ? label("state", field.value)
                    : field.format === "personMissing"
                      ? text(`wb.${field.value}`)
                      : field.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="wb-evidence-bodies">
        {presentation.bodies.map((body, i) => (
          <section key={i}>
            <h4>{text(`wb.evidenceField.${body.label}`)}</h4>
            {body.dueDate && (
              <p className="wb-evidence-meta">
                {text("wb.evidenceField.dueDate")} · {date(body.dueDate)}
              </p>
            )}
            <CollapsibleMessage
              content={body.content}
              previewHeight={180}
              expandLabel="expandFullText"
              images={false}
            />
          </section>
        ))}
      </div>
      {presentation.unavailable && (
        <p className="wb-evidence-empty">{text("wb.evidenceUnavailable")}</p>
      )}
      {destination ? (
        <Action onClick={onOpen}>
          <ExternalLink size={16} />
          {text(`wb.open.${destination}`)}
        </Action>
      ) : (
        <p>{text("wb.evidenceNoDestination")}</p>
      )}
    </div>
  );
}
