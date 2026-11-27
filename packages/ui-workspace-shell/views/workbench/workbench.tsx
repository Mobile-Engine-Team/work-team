import { usePageAssembly } from "../pages";
import { evidenceDestination } from "./evidence-presentation";
import { EvidenceDetails } from "./evidence-details";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Pin as PinIcon,
  Plus,
  Folder,
  ListTodo,
  Inbox,
  Users,
  Bot,
  ArrowUp,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { useTeam, text, teamApi } from "../team/client";
import { Action, Failure, Modal } from "../team/ui";
import {
  request,
  StateSchema,
  IDSchema,
  StatusSchema,
  WorkbenchAccessError,
  streamProgress,
  type Result,
  type Evidence,
} from "./api";
import { z } from "zod";
import "./workbench.css";
import { DynamicView, type LayoutStateChange } from "./dynamic-view";
import { AnswerOutcome, hasAnswerBody } from "./answer-outcome";
import type { State } from "./schemas";

function WorkbenchTable({
  block,
  refs,
}: {
  block: Result["view"]["blocks"][number];
  refs: (ids: string[]) => ReactNode;
}) {
  const columns =
    block.columns?.length &&
    block.items.every((item) => item.cells?.length === block.columns?.length)
      ? block.columns
      : undefined;
  return (
    <div className="wb-table-scroll">
      <table>
        <thead>
          <tr>
            {columns ? (
              columns.map((column, i) => <th key={i}>{column}</th>)
            ) : (
              <>
                <th>{text("name")}</th>
                <th>{text("wb.details")}</th>
              </>
            )}
            <th>{text("wb.evidence")}</th>
          </tr>
        </thead>
        <tbody>
          {block.items.map((item, i) => (
            <tr key={i}>
              {columns ? (
                item.cells?.map((cell, j) => <td key={j}>{cell}</td>)
              ) : (
                <>
                  <td>
                    {item.title}
                    {item.group && <small>{item.group}</small>}
                  </td>
                  <td>
                    {item.value && <strong>{item.value}</strong>}
                    {item.text}
                  </td>
                </>
              )}
              <td>{refs(item.evidenceIds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function View({
  result,
  generating = false,
  onEvidence,
  onEntity,
  onFollowUp,
  onStateChange,
}: {
  result: Result;
  generating?: boolean;
  onEvidence: (e: Evidence) => void;
  onEntity: (e: Evidence) => void;
  onFollowUp: (s: string) => void;
  onStateChange?: LayoutStateChange;
}) {
  if (result.dynamic)
    return (
      <DynamicView
        result={result}
        generating={generating}
        onEvidence={onEvidence}
        onEntity={onEntity}
        onStateChange={onStateChange}
        onFollowUp={onFollowUp}
      />
    );
  const refs = (ids: string[]) =>
    ids.map((id) => {
      const e = result.evidence.find((x) => x.id === id);
      return e ? (
        <button
          className="wb-evidence-link"
          key={id}
          onClick={() => onEvidence(e)}
        >
          {e.title || e.kind}
          <ExternalLink size={11} />
        </button>
      ) : null;
    });
  return (
    <div className="wb-result">
      <header>
        <h2>{result.view.title}</h2>
        <small>
          {text("wb.snapshot")} ·{" "}
          {new Date(result.generatedAt).toLocaleString()}
        </small>
      </header>
      <div className="wb-blocks">
        {result.view.blocks.map((block, index) => (
          <section key={index} className={`wb-block wb-${block.type}`}>
            <h3>{block.title}</h3>
            {block.text && <p>{block.text}</p>}
            {block.type === "table" ? (
              <WorkbenchTable block={block} refs={refs} />
            ) : (
              <div className="wb-items">
                {block.items.map((item, i) => (
                  <article key={i}>
                    {item.group && (
                      <small className="wb-group">{item.group}</small>
                    )}
                    {item.value && (
                      <strong className="wb-value">{item.value}</strong>
                    )}
                    <h4>{item.title}</h4>
                    {item.text && <p>{item.text}</p>}
                    <div className="wb-refs">{refs(item.evidenceIds)}</div>
                  </article>
                ))}
              </div>
            )}
            <div className="wb-refs">{refs(block.evidenceIds)}</div>
          </section>
        ))}
      </div>
      {result.view.limitations.length > 0 && (
        <aside className="wb-limitations">
          <strong>{text("wb.limitations")}</strong>
          {result.view.limitations.map((item, i) => (
            <p key={i}>{item}</p>
          ))}
        </aside>
      )}
    </div>
  );
}

export function WorkbenchShell({
  children,
  view,
  issueId,
}: {
  children: ReactNode;
  view: string;
  issueId?: string;
}) {
  const { workspace, user } = useTeam();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const client = useQueryClient();
  const { entries } = usePageAssembly();
  const inbox = useQuery({
    enabled: entries.has("inbox"),
    queryKey: ["team", workspace.id, "inbox", false],
    queryFn: () => teamApi.listInbox(),
  });
  const unread = inbox.data?.filter((item) => !item.read).length || 0;
  const conversation = params.get("conversation") || "";
  const pinID = params.get("pin") || "";
  const sourcePin = params.get("sourcePin") || "";
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [progress, setProgress] = useState("");
  const [revokedAt, setRevokedAt] = useState(0);
  const layoutStates = useRef<
    Record<string, Record<string, Record<string, unknown>>>
  >({});
  const [modelId, setModelId] = useState("");
  const scope = `${user.id}:${workspace.id}`;
  useEffect(() => {
    layoutStates.current = {};
  }, [scope, revokedAt]);
  const draftKey = `mobilework.workbench.draft:${scope}:${conversation || "new"}`;
  const [draft, setDraft] = useState(
    () => localStorage.getItem(draftKey) || "",
  );
  const composerInput = useRef<HTMLTextAreaElement>(null);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [canExpandComposer, setCanExpandComposer] = useState(false);
  useLayoutEffect(() => {
    const input = composerInput.current;
    if (!input) return;
    const resize = () => {
      const normalLimit = Math.min(180, window.innerHeight * 0.25);
      const limit = composerExpanded ? Math.min(420, window.innerHeight * 0.45) : normalLimit;
      input.style.height = "0px";
      const fullHeight = input.scrollHeight;
      input.style.height = `${Math.max(64, Math.min(fullHeight, limit))}px`;
      setCanExpandComposer(fullHeight > normalLimit);
    };
    resize();
    let width = input.clientWidth;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth !== width) { width = input.clientWidth; resize(); }
    });
    observer.observe(input);
    window.addEventListener("resize", resize);
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, [draft, composerExpanded, view, pinID]);
  useEffect(() => { setComposerExpanded(false); }, [draftKey]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setDraft(localStorage.getItem(draftKey) || "");
  }, [draftKey]);
  const queryKey = ["team", workspace.id, "workbench", user.id, conversation];
  const state = useQuery({
    queryKey,
    queryFn: () =>
      request(
        workspace.id,
        conversation ? `?conversation=${conversation}` : "",
        StateSchema,
      ),
    refetchInterval: (q) =>
      q.state.data?.runtimeStatus === "warming" ||
      q.state.data?.runtimeStatus === "unavailable" ||
      q.state.data?.messages.some((m) => m.status === "running") ||
      q.state.data?.pins.some((p) => p.status === "refreshing")
        ? 1500
        : 15000,
  });
  const data =
    state.error instanceof WorkbenchAccessError ||
    state.dataUpdatedAt <= revokedAt
      ? undefined
      : state.data;
  useEffect(() => {
    if (!(state.error instanceof WorkbenchAccessError)) return;
    layoutStates.current = {};
    layoutStates.current = {};
    setEvidence(null);
    client.removeQueries({
      queryKey: ["team", workspace.id, "workbench", user.id],
      predicate: (q) => q.queryKey[4] !== conversation,
    });
    // Drop the active query's cached private payload while retaining its access error.
    const query = client.getQueryCache().find({ queryKey, exact: true });
    if (query?.state.data !== undefined) query.setState({ data: undefined });
  }, [state.error, workspace.id, user.id, conversation, client]);
  useEffect(() => {
    if (
      !data?.messages.some((m) => m.status === "unavailable") &&
      !data?.pins.some((p) => p.status === "unavailable")
    )
      return;
    layoutStates.current = {};
    setEvidence(null);
    client.removeQueries({
      queryKey: ["team", workspace.id, "workbench", user.id],
      predicate: (q) => q.queryKey[4] !== conversation,
    });
  }, [state.dataUpdatedAt, workspace.id, user.id, conversation, client]);
  const pin = data?.pins.find((p) => p.id === pinID);
  const active = data?.messages.find((m) => m.status === "running");
  const runtimeNotice = data?.modelReady ? "" : text(
    data?.runtimeStatus === "warming" ? "wb.warming" :
    data?.runtimeStatus === "unavailable" ? "wb.recovering" : "wb.noModel",
  );
  const refreshState = () =>
    client.invalidateQueries({
      queryKey: ["team", workspace.id, "workbench", user.id],
    });
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void streamProgress(
      workspace.id,
      active.id,
      controller.signal,
      setProgress,
      (message) =>
        client.setQueryData<State>(queryKey, (previous) => {
          if (!previous) return previous;
          return {
            ...previous,
            messages: previous.messages.map((old) =>
              old.id === message.id &&
              (message.result?.dynamic?.seq || 0) >=
                (old.result?.dynamic?.seq || 0)
                ? message
                : old,
            ),
          };
        }),
    ).catch((error) => {
      if (error instanceof WorkbenchAccessError) {
        setRevokedAt(Date.now());
        client.setQueryData<State>(queryKey, (previous) =>
          previous ? { ...previous, messages: [], pins: [] } : previous,
        );
        client.removeQueries({
          queryKey: ["team", workspace.id, "workbench", user.id],
        });
        setEvidence(null);
        void refreshState();
      }
    });
    return () => {
      controller.abort();
      setProgress("");
    };
  }, [active?.id, workspace.id]);
  const send = useMutation({
    mutationFn: async (retryPrompt?: string) => {
      const prompt = (retryPrompt ?? draft).trim();
      if (!prompt || !data?.modelReady) return;
      const pendingKey = `mobilework.workbench.pending:${scope}:${conversation || "new"}`;
      const cached = z
        .object({
          requestId: z.string(),
          conversationId: z.string(),
          prompt: z.string(),
          modelId: z.string().default(""),
        })
        .safeParse(JSON.parse(localStorage.getItem(pendingKey) || "null"));
      let id = conversation;
      if (
        !id &&
        cached.success &&
        cached.data.prompt === prompt &&
        cached.data.modelId === modelId
      )
        id = cached.data.conversationId;
      if (!id) {
        const c = await request(workspace.id, "/conversations", IDSchema, {
          title: prompt.slice(0, 80),
        });
        id = c.id;
      }
      const requestId =
        cached.success &&
        cached.data.prompt === prompt &&
        cached.data.modelId === modelId
          ? cached.data.requestId
          : crypto.randomUUID();
      localStorage.setItem(
        pendingKey,
        JSON.stringify({ requestId, conversationId: id, prompt, modelId }),
      );
      const latest = data?.messages
        .filter((m) => m.status === "completed")
        .at(-1);
      await request(workspace.id, "/messages", IDSchema, {
        requestId,
        conversationId: id,
        prompt,
        modelId,
        sourcePinId: latest ? undefined : sourcePin || undefined,
        layoutState:
          layoutStates.current[
            latest ? `message:${latest.id}` : `pin:${sourcePin}`
          ],
      });
      localStorage.removeItem(pendingKey);
      if (retryPrompt === undefined) localStorage.removeItem(draftKey);
      if (mounted.current) {
        if (retryPrompt === undefined) setDraft("");
        setParams({
          view: "workbench",
          conversation: id,
          ...(sourcePin ? { sourcePin } : {}),
        });
      }
      await refreshState();
    },
  });
  const pinAction = useMutation({
    mutationFn: async ({
      messageId,
      replace = false,
    }: {
      messageId: string;
      replace?: boolean;
    }) => {
      const original = replace
        ? data?.pins.find((p) => p.id === sourcePin)
        : undefined;
      const saved = await request(
        workspace.id,
        original ? `/pins/${original.id}` : "/pins",
        IDSchema,
        { messageId, ...(original ? { revision: original.revision } : {}) },
        original ? "PUT" : "POST",
      );
      await refreshState();
      if (mounted.current) setParams({ view: "workbench", pin: saved.id });
    },
  });
  const refresh = useMutation({
    mutationFn: async (id: string) => {
      const response = await request(workspace.id, `/pins/${id}/refresh`, StatusSchema, {});
      await refreshState();
      return { id, status: response.status };
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await request(
        workspace.id,
        `/pins/${id}`,
        z.object({ ok: z.boolean() }),
        undefined,
        "DELETE",
      );
      if (mounted.current) setParams({ view: "workbench" });
      await refreshState();
    },
  });
  const cancelRun = useMutation({
    mutationFn: async (id: string) => {
      await request(workspace.id, `/messages/${id}/cancel`, StatusSchema, {});
      await refreshState();
    },
  });
  const prefill = (value: string) => {
    setDraft(value);
    localStorage.setItem(draftKey, value);
  };
  const attempted = useRef(new Set<string>());
  const refreshBudget = useRef({ pin: "", count: 0, last: 0 });
  useEffect(() => {
    if (
      !pin ||
      !data ||
      pin.status === "refreshing" ||
      !data?.modelReady ||
      pin.result?.fingerprint === pin.refreshKey
    )
      return;
    if (refreshBudget.current.pin !== pin.id)
      refreshBudget.current = { pin: pin.id, count: 0, last: 0 };
    if (
      refreshBudget.current.count >= 2 ||
      Date.now() - refreshBudget.current.last < 30000
    )
      return;
    const key = `${pin.id}:${pin.refreshKey}`;
    if (attempted.current.has(key)) return;
    attempted.current.add(key);
    refreshBudget.current.count++;
    refreshBudget.current.last = Date.now();
    refresh.mutate(pin.id);
  }, [pin?.id, pin?.status, pin?.result?.fingerprint, pin?.refreshKey, data?.modelReady]);
  const to = (query: Record<string, string>) =>
    navigate(`/team/${workspace.slug}?${new URLSearchParams(query)}`);
  const returnQuery: Record<string, string> = conversation
    ? { view: "workbench", conversation, ...(sourcePin ? { sourcePin } : {}) }
    : pinID
      ? { view: "workbench", pin: pinID }
      : { view: "workbench" };
  const openEvidence = (e: Evidence) => {
    setEvidence(null);
    const back = new URLSearchParams(returnQuery).toString();
    const destination = evidenceDestination(e);
    if (destination === "topic" && e.topicId)
      to({
        view: "projects",
        project: e.projectId,
        section: "discussion",
        topic: e.topicId,
        return: back,
        ...(e.kind === "comment" ? { comment: e.objectId } : {}),
      });
    else if (destination === "issue")
      navigate(
        `/team/${workspace.slug}/issue/${e.issueId}?${new URLSearchParams({ return: back, ...(e.kind === "comment" ? { comment: e.objectId } : {}) })}`,
      );
    else if (destination === "project")
      to({ view: "projects", project: e.projectId, return: back });
  };
  const showing = view === "workbench" && !issueId;
  const counts = data?.catalog.counts;
  const recommendations =
    counts && counts.issue > 0
      ? [text("wb.question1"), text("wb.question2"), text("wb.question3")]
      : [text("wb.emptyQuestion")];
  return (
    <div className="wb-shell">
      <aside className="wb-sidebar">
        <button aria-label={text("wb.newChat")} className="wb-new" onClick={() => to({ view: "workbench" })}>
          <Plus size={17} />
          {text("wb.newChat")}
        </button>
        <div className="wb-sidebar-scroll">
          <h4>{text("wb.myViews")}</h4>
          {data?.pins.map((p) => (
            <button
              aria-label={p.name}
              className={pinID === p.id && showing ? "active" : ""}
              key={p.id}
              onClick={() => to({ view: "workbench", pin: p.id })}
            >
              <PinIcon size={15} />
              <span>{p.name}</span>
            </button>
          ))}
          {!data?.pins.length && <small>{text("wb.noPins")}</small>}
          <h4>{text("wb.capabilities")}</h4>
          {[
            { id: "projects", label: text("project.projects"), Icon: Folder },
            { id: "tasks", label: text("tasks"), Icon: ListTodo },
            { id: "inbox", label: text("inbox"), Icon: Inbox },
            { id: "squads", label: text("squads"), Icon: Bot },
            { id: "settings", label: text("settings"), Icon: Users },
          ].filter(({ id }) => id === "projects" || entries.has(id)).map(({ id, label, Icon }) => (
            <button
              key={id}
              aria-label={label}
              className={view === id ? "active" : ""}
              onClick={() => to({ view: id })}
            >
              <Icon size={17} />
              {label}
              {id === "inbox" && unread > 0 && (
                <span className="team-unread-count">{unread}</span>
              )}
            </button>
          ))}
          <h4>{text("wb.recent")}</h4>
          {data?.conversations.map((c) => (
            <button
              aria-label={c.title}
              className={conversation === c.id && showing ? "active" : ""}
              key={c.id}
              onClick={() => to({ view: "workbench", conversation: c.id })}
            >
              <MessageSquare size={15} />
              <span>{c.title}</span>
            </button>
          ))}
        </div>
        <footer>
          {user.name}
          <small>
            {workspace.kind === "personal"
              ? text("wb.personal")
              : text("workspaceTeam")}
          </small>
        </footer>
      </aside>
      <main className="wb-main">
        {!showing ? (
          <>
            {params.get("return") && (
              <Action
                onClick={() =>
                  navigate(`/team/${workspace.slug}?${params.get("return")}`)
                }
              >
                <ArrowLeft size={15} />
                {text("wb.back")}
              </Action>
            )}
            {children}
          </>
        ) : (
          <>
            <div className="wb-chat-content">
              <Failure
                error={
                  state.error ||
                  send.error ||
                  pinAction.error ||
                  refresh.error ||
                  remove.error
                }
              />
              {!data && state.isPending && <p>{text("loading")}</p>}
              {pin ? (
                <>
                  <div className="wb-pin-toolbar">
                    <span>
                      <PinIcon size={16} />
                      {text("wb.liveView")}
                    </span>
                    <Action
                      disabled={
                        pin.status === "refreshing" || refresh.isPending || !data?.modelReady
                      }
                      onClick={() => refresh.mutate(pin.id)}
                    >
                      <RefreshCw size={15} />
                      {text(pin.status === "refreshing" || refresh.isPending ? "wb.refreshBusy" : "wb.refresh")}
                    </Action>
                    <Action
                      onClick={() => {
                        setDraft(pin.intent);
                        localStorage.setItem(draftKey, pin.intent);
                        setParams({ view: "workbench", sourcePin: pin.id });
                      }}
                    >
                      {text("wb.adjust")}
                    </Action>
                    <Action onClick={() => remove.mutate(pin.id)}>
                      <Trash2 size={15} />
                      {text("wb.unpin")}
                    </Action>
                  </div>
                  {runtimeNotice && <p role="status">{runtimeNotice}</p>}
                  {pin.status === "refreshing" && (
                    <p className="wb-progress">{text("wb.refreshing")}</p>
                  )}
                  {pin.status !== "refreshing" && pin.error && <p role="alert" className="wb-answer-failure">{text("wb.refreshFailed")}</p>}
                  {pin.status === "ready" && pin.result?.fingerprint === pin.refreshKey && refresh.data?.id === pin.id && refresh.data.status === "ready" && !refresh.isPending && <p role="status">{text("wb.upToDate")}</p>}
                  {pin.result && (
                    <View
                      key={`pin:${pin.id}`}
                      result={pin.result}
                      onStateChange={(id, state) => {
                        const key = `pin:${pin.id}`;
                        layoutStates.current[key] = {
                          ...layoutStates.current[key],
                          [id]: state,
                        };
                      }}
                      onEvidence={setEvidence}
                      onEntity={openEvidence}
                      onFollowUp={prefill}
                    />
                  )}
                </>
              ) : conversation ? (
                <div className="wb-messages">
                  {data?.messages.map((m) => (
                    <section key={m.id}>
                      <div className="wb-question">{m.prompt}</div>
                      {m.status === "running" && (
                        <div className="wb-progress">
                          {progress || m.progress || text("wb.working")}{" "}
                          <Action onClick={() => cancelRun.mutate(m.id)}>
                            {text("wb.cancel")}
                          </Action>
                        </div>
                      )}
                      <AnswerOutcome
                        failed={m.status !== "running" && m.status !== "completed"}
                        hasBody={hasAnswerBody(m.result)}
                        notice={text(m.status === "cancelled" ? "wb.answerStopped" : m.status === "interrupted" ? "wb.answerInterrupted" : hasAnswerBody(m.result) ? "wb.answerPartial" : "wb.answerFailed")}
                        retryLabel={text("wb.answerRetry")}
                        retryDisabled={send.isPending || !!active || !data?.modelReady}
                        onRetry={() => send.mutate(m.prompt)}
                      >
                      {m.result && (
                        <>
                          <View
                            key={`message:${m.id}`}
                            result={m.result}
                            generating={m.status === "running"}
                            onStateChange={(id, state) => {
                              const key = `message:${m.id}`;
                              layoutStates.current[key] = {
                                ...layoutStates.current[key],
                                [id]: state,
                              };
                            }}
                            onEvidence={setEvidence}
                      onEntity={openEvidence}
                            onFollowUp={prefill}
                          />
                          {m.status === "completed" && <Action
                            disabled={pinAction.isPending}
                            onClick={() =>
                              pinAction.mutate({ messageId: m.id })
                            }
                          >
                            <PinIcon size={15} />
                            {text("wb.pin")}
                          </Action>}
                          {sourcePin && m.status === "completed" && (
                            <Action
                              disabled={
                                pinAction.isPending || m.status !== "completed"
                              }
                              onClick={() =>
                                pinAction.mutate({
                                  messageId: m.id,
                                  replace: true,
                                })
                              }
                            >
                              {text("wb.replacePin")}
                            </Action>
                          )}
                        </>
                      )}
                      </AnswerOutcome>
                    </section>
                  ))}
                </div>
              ) : (
                <section className="wb-welcome">
                  <span className="wb-eyebrow">{workspace.name}</span>
                  <h1>{text("wb.welcome")}</h1>
                  <p>{text("wb.welcomeHint")}</p>
                  <div className="wb-prompts">
                    {recommendations.map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setDraft(q);
                          localStorage.setItem(draftKey, q);
                        }}
                      >
                        {q}
                        <ArrowUp size={15} />
                      </button>
                    ))}
                  </div>
                  {counts && (
                    <div className="wb-counts">
                      <span>
                        {counts.project || 0} {text("project.projects")}
                      </span>
                      <span>
                        {counts.issue || 0} {text("tasks")}
                      </span>
                      <span>
                        {counts.topic || 0} {text("wb.topics")}
                      </span>
                    </div>
                  )}
                </section>
              )}
            </div>
            {!pin && (
              <form
                className="wb-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim() && data?.modelReady && !send.isPending && !active) send.mutate(undefined);
                }}
              >
                <textarea
                  ref={composerInput}
                  aria-label={text("wb.placeholder")}
                  value={draft}
                  placeholder={text("wb.placeholder")}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    localStorage.setItem(draftKey, e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      if (draft.trim() && data?.modelReady && !send.isPending && !active)
                        send.mutate(undefined);
                    }
                  }}
                />
                <select
                  className="wb-model-picker"
                  aria-label={text("wb.model")}
                  value={
                    modelId || data?.models.find((m) => m.default)?.id || ""
                  }
                  onChange={(e) => setModelId(e.target.value)}
                >
                  {data?.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                      {m.default ? ` · ${text("wb.defaultModel")}` : ""}
                    </option>
                  ))}
                </select>
                {(canExpandComposer || composerExpanded) && (
                  <button type="button" className="wb-composer-expand"
                    aria-expanded={composerExpanded}
                    onClick={() => setComposerExpanded((previous) => !previous)}>
                    {text(composerExpanded ? "wb.collapseInput" : "wb.expandInput")}
                  </button>
                )}
                <button
                  className="wb-send"
                  aria-label={text("wb.send")}
                  disabled={
                    !draft.trim() ||
                    send.isPending ||
                    !!active ||
                    !data?.modelReady
                  }
                >
                  <ArrowUp size={20} />
                </button>
                <small role="status" className={runtimeNotice ? "wb-runtime-notice" : undefined}>
                  {data ? runtimeNotice || text("wb.private") : text("loading")}
                </small>
              </form>
            )}
          </>
        )}
      </main>
      {evidence &&
        data &&
        [...data.messages, ...data.pins].some((item) =>
          item.result?.evidence.some((ref) => ref.id === evidence.id),
        ) && (
          <Modal title={text("wb.evidence")} onClose={() => setEvidence(null)}>
            <EvidenceDetails key={evidence.id} evidence={evidence} onOpen={() => openEvidence(evidence)} />
          </Modal>
        )}
    </div>
  );
}
