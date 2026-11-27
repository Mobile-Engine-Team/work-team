import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import type { Agent } from "@multica/core/types";
import { teamApi, text, useTeamAction, useTeamQuery } from "./client";
import { Action, Modal, Failure } from "./ui";

export function AgentDelete({ agent, onArchived }: { agent: Pick<Agent, "id" | "name">; onArchived?: () => void }) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useSearchParams();
  const squads = useTeamQuery(["squads"], () => teamApi.listSquads(), open);
  const led = (squads.data || []).filter(s => !s.archived_at && s.leader_id === agent.id);
  const remove = useTeamAction(async () => {
    try {
      await teamApi.archiveAgent(agent.id);
    } catch (error) {
      await squads.refetch();
      throw error;
    }
    setOpen(false);
    onArchived?.();
  });
  const blocked = led.length > 0;
  return (
    <>
      <Action onClick={() => { remove.reset(); setOpen(true); }}>{text("archiveAgent")}</Action>
      {open && (
        <Modal className="directory-archive-dialog"
          title={text(blocked ? "replaceSquadLeader" : "archiveAgent")}
          onClose={() => { if (!remove.isPending) setOpen(false); }}>
          <div className="directory-archive-body">
            {blocked ? <>
              <p>{text("replaceSquadLeaderHint").replace("{name}", agent.name)}</p>
              <div className="directory-led-squads">{led.map(s =>
                <Action key={s.id} onClick={() => { setOpen(false); navigate({view:"squads", squad:s.id}); }}>
                  {s.name}<ArrowRight size={15} aria-hidden="true" />
                </Action>
              )}</div>
            </> : <>
              <p>{text("confirmArchiveName").replace("{name}", agent.name)}</p>
              <p className="directory-archive-help">{text("archiveAgentHint")}</p>
            </>}
            <Failure error={squads.error} />
            {squads.isError && <Action onClick={() => void squads.refetch()}>{text("retry")}</Action>}
            <Failure error={remove.error} />
          </div>
          <div className="directory-archive-footer">
            <Action disabled={remove.isPending} onClick={() => setOpen(false)}>
              {text(blocked ? "close" : "cancel")}
            </Action>
            {!blocked && <Action primary disabled={remove.isPending || squads.isFetching || !squads.isSuccess}
              onClick={() => remove.mutate()}>
              {text(remove.isPending ? "archivingAgent" : "confirmArchiveAgent")}
            </Action>}
          </div>
        </Modal>
      )}
    </>
  );
}
