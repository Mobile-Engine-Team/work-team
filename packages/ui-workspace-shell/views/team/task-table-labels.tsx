import { useState } from "react";
import { IDSchema, request } from "../workbench/api";
import { useTeam, useTeamAction } from "./client";
import { Failure } from "./ui";

export function TaskTableLabels({ id, identifier, revision, names, label, placeholder="—" }: {
  id: string; identifier: string; revision?: number; names: string[]; label?: string; placeholder?: string;
}) {
  const {workspace} = useTeam();
  const [draft, setDraft] = useState<{ text: string; revision: number } | null>(null);
  const saved = names.join(", ");
  const update = useTeamAction(async (edit: {text: string; revision: number}) => {
    await request(workspace.id, "/issues/" + id + "/labels", IDSchema, {
      names: edit.text.split(/[,，]/).map(s => s.trim()).filter(Boolean),
      expected_revision: edit.revision,
    }, "PUT");
    setDraft(null);
  });
  return <>
    <input className="v3-table-labels" aria-label={label || identifier + " 标签"} placeholder={placeholder}
      value={draft?.text ?? saved} disabled={!revision || update.isPending}
      onChange={e => revision && setDraft({text:e.target.value, revision:draft?.revision ?? revision})}
      onBlur={() => {
        if (draft && draft.text !== saved) update.mutate(draft);
        else setDraft(null);
      }}
      onKeyDown={e => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") { e.preventDefault(); setDraft(null); update.reset(); }
      }}/>
    <Failure error={update.error}/>
  </>;
}
