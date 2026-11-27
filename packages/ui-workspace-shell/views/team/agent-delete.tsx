import { useState } from "react";
import type { Agent } from "@multica/core/types";
import { teamApi, text, useTeamAction } from "./client";
import { Action, Modal, Failure } from "./ui";

export function AgentDelete({ agent }: { agent: Pick<Agent, "id" | "name"> }) {
  const [open, setOpen] = useState(false);
  const remove = useTeamAction(async () => {
    await teamApi.archiveAgent(agent.id);
    setOpen(false);
  });
  return (
    <>
      <Action
        onClick={() => {
          remove.reset();
          setOpen(true);
        }}
      >
        {text("deleteAgent")}
      </Action>
      {open && (
        <Modal
          title={`${text("deleteAgent")} · ${agent.name}`}
          onClose={() => {
            if (!remove.isPending) setOpen(false);
          }}
        >
          <p>{text("deleteAgentHint")}</p>
          <Failure error={remove.error} />
          <div className="team-toolbar">
            <Action disabled={remove.isPending} onClick={() => setOpen(false)}>
              {text("cancel")}
            </Action>
            <Action
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {text(remove.isPending ? "deletingAgent" : "confirmDeleteAgent")}
            </Action>
          </div>
        </Modal>
      )}
    </>
  );
}
