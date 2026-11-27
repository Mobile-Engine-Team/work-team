const start = "\n\n<!-- mw-blueprint-requirements -->\n";
const end = "\n<!-- /mw-blueprint-requirements -->";
export function splitProjectRequirements(value: string) {
  const first = value.indexOf(start),
    last = value.indexOf(end, first + start.length);
  if (first < 0 || last < 0) return { description: value, requirements: null };
  return {
    description: value.slice(0, first) + value.slice(last + end.length),
    requirements: value.slice(first + start.length, last),
  };
}
export function joinProjectRequirements(
  description: string,
  requirements: string | null,
) {
  return requirements !== null
    ? description + start + requirements + end
    : description;
}
export function displayProjectRequirements(content: string) {
  return content.replace(/<!-- \/?mw-blueprint-requirements -->/g, "");
}

// Strip only suffixes verified against the task's adopted immutable snapshots.
export function taskRequirementsBody(
  description: string,
  adopted: readonly string[],
) {
  let body = description;
  let changed = true;
  while (changed) {
    changed = false;
    for (const content of adopted) {
      const suffix = "\n\n采用的话题结论：\n" + content;
      if (body.endsWith(suffix)) {
        body = body.slice(0, -suffix.length);
        changed = true;
        break;
      }
    }
  }
  return body;
}
export function importProjectRequirements(
  description: string,
  adopted: readonly string[],
) {
  const body = taskRequirementsBody(description, adopted);
  return splitProjectRequirements(body).requirements ?? body;
}
