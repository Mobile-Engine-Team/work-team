import { z } from "zod";
import type { Evidence } from "./schemas";
import { splitProjectRequirements } from "../team/project-requirements";

const recordSchema = z.record(z.string(), z.unknown());
type RecordData = z.infer<typeof recordSchema>;
export type EvidenceField = {
  label: string;
  value: string;
  format?: "date" | "status" | "personMissing";
};
export type EvidenceBody = { label: string; content: string; dueDate?: string };
export type EvidencePresentation = {
  fields: EvidenceField[];
  bodies: EvidenceBody[];
  unavailable: boolean;
};
const string = (data: RecordData, key: string) =>
  typeof data[key] === "string" ? data[key].trim() : "";

// Read only the saved snapshot. Unknown keys and serialized fallback data never enter the UI.
export function presentEvidence(e: Evidence): EvidencePresentation {
  const fields: EvidenceField[] = [],
    bodies: EvidenceBody[] = [];
  const field = (
    label: string,
    value: string,
    format?: EvidenceField["format"],
  ) => {
    if (value) fields.push({ label, value, format });
  };
  const body = (label: string, content: string, dueDate?: string) => {
    const clean = content.replace(/<!--[^]*?-->/g, "").trim();
    if (clean)
      bodies.push({ label, content: clean, ...(dueDate ? { dueDate } : {}) });
  };
  // Conclusions are stored as original text, not JSON envelopes (including Markdown links/code).
  if (e.kind === "conclusion") {
    body("original", e.text);
    return { fields, bodies, unavailable: bodies.length === 0 };
  }
  let data: RecordData | undefined;
  try {
    const parsed = recordSchema.safeParse(JSON.parse(e.text));
    if (parsed.success) data = parsed.data;
  } catch {
    /* Plain text is supported only for sources that actually store it. */
  }
  if (!data) {
    if (
      ["comment", "resource"].includes(e.kind) &&
      !/^\s*(?:[\[{]|```)/.test(e.text)
    )
      body("original", e.text);
    return { fields, bodies, unavailable: bodies.length === 0 };
  }
  const person = (key: string, id: string) => {
    const name = string(data, key);
    if (name) field(key, name);
    else field(key, string(data, id) ? "unresolved" : "unset", "personMissing");
  };
  switch (e.kind) {
    case "issue": {
      person("assigneeName", "assigneeId");
      const parts = splitProjectRequirements(
        typeof data.description === "string" ? data.description : "",
      );
      body("description", parts.description);
      body("requirements", parts.requirements || "");
      body("acceptanceCriteria", string(data, "acceptanceCriteria"));
      break;
    }
    case "project":
      person("leadName", "leadId");
      body("description", string(data, "description"));
      break;
    case "comment":
      person("authorName", "authorId");
      body("original", string(data, "content"));
      break;
    case "topic":
      if (
        typeof data.conclusionRevision === "number" &&
        data.conclusionRevision > 0
      )
        field("conclusionVersion", String(data.conclusionRevision));
      body("conclusion", string(data, "conclusion"));
      body("draft", string(data, "draft"));
      break;
    case "blueprint": {
      const nodes = z.array(recordSchema).safeParse(data.nodes);
      if (nodes.success) {
        for (const node of nodes.data) {
          const title = string(node, "title");
          if (!title) continue;
          // Titles and requirements are source text; render each as its own body, not interpolated JSON.
          body(
            "plannedTask",
            title + "\n\n" + string(node, "requirements"),
            string(node, "due_date"),
          );
        }
        const edges = z.array(recordSchema).safeParse(data.edges);
        if (edges.success)
          for (const edge of edges.data) {
            const from = nodes.data.find((n) => n.id === edge.from),
              to = nodes.data.find((n) => n.id === edge.to);
            if (from && to)
              body(
                "dependency",
                string(from, "title") + " → " + string(to, "title"),
              );
            body("handoff", string(edge, "handoff"));
          }
      }
      break;
    }
    case "dependency":
      field("task", string(data, "issueTitle"));
      field("status", string(data, "issueStatus"), "status");
      field("predecessor", string(data, "dependsOnTitle"));
      field("predecessorStatus", string(data, "dependsOnStatus"), "status");
      break;
    case "resource":
      body("description", string(data, "description"));
      body("original", string(data, "content"));
      field("url", string(data, "url"));
      field("path", string(data, "local_path"));
      field("ref", string(data, "ref"));
      break;
  }
  if (e.kind === "issue" || e.kind === "project") {
    field("startDate", string(data, "startDate"), "date");
    field("dueDate", string(data, "dueDate"), "date");
  }
  return {
    fields,
    bodies,
    unavailable:
      !bodies.length && !fields.some((f) => f.format !== "personMissing"),
  };
}

export function evidenceDestination(e: Evidence) {
  if (e.topicId && e.projectId) return "topic";
  if (e.issueId) return "issue";
  if (e.projectId) return "project";
  return null;
}
