import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  MODELS_GC_TIME_MS,
  resolveRuntimeModels,
  runtimeModelsKeys,
  staleTimeFor,
} from "@multica/core/runtimes/models";
import { Action, Input, Failure } from "./ui";
import { text, useTeam } from "./client";
import { ModelAuthPanel, useCodexModelAuth } from "./model-auth";

export function ModelPicker({
  runtimeId,
  online,
  provider,
  local,
  value,
  onChange,
}: {
  runtimeId: string;
  online: boolean;
  provider?: string;
  local: boolean;
  value: string;
  onChange: (id: string) => void;
}) {
  const { workspace } = useTeam();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const localCodex = local && online && provider === "codex";
  const auth = useCodexModelAuth(localCodex);
  const needsAuth = localCodex && auth.data?.state === "running" && !auth.data.configured;
  const catalog = (force: boolean) =>
    resolveRuntimeModels(runtimeId, { force, workspaceSlug: workspace.slug });
  const key = runtimeModelsKeys.forRuntime(runtimeId);
  const catalogOptions = queryOptions({
    // Authorization changes must bypass both the old client data and the
    // server's runtime-wide cache. A manual refresh keeps the same query key.
    queryKey: localCodex
      ? [...key, "codex-auth", auth.data?.credentialVersion ?? (auth.data?.configured ? "configured" : "unconfigured")]
      : key,
    enabled: online && !!runtimeId && (!localCodex || !auth.isPending),
    queryFn: () => catalog(localCodex && !!auth.data),
    staleTime: (result) => staleTimeFor(result.state.data),
    gcTime: MODELS_GC_TIME_MS,
    retry: false,
  });
  const query = useQuery(catalogOptions);
  const supported = query.data?.supported !== false;
  const models = query.data?.models ?? [];
  const filtered = models.filter((model) =>
    `${model.id} ${model.label}`.toLowerCase().includes(search.toLowerCase()),
  );
  const select = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };
  return (
    <div className="team-model-picker">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next && localCodex) void auth.refetch();
          if (!next) {
            setSearch("");
            setShowAuth(false);
          }
        }}
      >
        <PopoverTrigger
          className="team-model-trigger"
          aria-label={text("model")}
        >
          <span>
            {models.find((model) => model.id === value)?.label ||
              value ||
              text("modelDefault")}
          </span>
          <ChevronDown size={16} />
        </PopoverTrigger>
        <PopoverContent className="team-model-popup" align="start">
          <div className="team-toolbar">
            <strong>{text("model")}</strong>
            <Action
              disabled={!catalogOptions.enabled || query.isFetching}
              onClick={() => {
                void client.fetchQuery({
                  ...catalogOptions,
                  queryFn: () => catalog(true),
                  staleTime: 0,
                }).catch(() => {
                  /* Query owns the error. */
                });
              }}
            >
              {text("refreshModels")}
            </Action>
            <Action onClick={() => setOpen(false)}>{text("close")}</Action>
          </div>
          {!online && <small>{text("modelsOffline")}</small>}
          {localCodex && auth.isError && (
            <small role="status">{text("modelAuthorizationUnavailable")}</small>
          )}
          {needsAuth && (
            <>
              <small role="status">{text("modelCatalogSignInHint")}</small>
              {!showAuth && (
                <div>
                  <Action onClick={() => setShowAuth(true)}>{text("modelSettings")}</Action>
                </div>
              )}
            </>
          )}
          {showAuth && localCodex && (
            auth.data?.configured
              ? <small role="status">{text("modelCatalogAuthorized")}</small>
              : <ModelAuthPanel />
          )}
          {provider === "codex" && query.data && !needsAuth && (
            <small>{text(query.data.cached ? "modelCatalogCached" : "modelCatalogEndpoint")}</small>
          )}
          {query.isFetching && (
            <small role="status">{text("discoveringModels")}</small>
          )}
          {query.data && query.isError
            ? <small role="alert">{text("modelCatalogRefreshFailed")}</small>
            : <Failure error={query.error} />}
          {!supported ? (
            <p>{text("modelManaged")}</p>
          ) : (
            <>
              <Input
                autoFocus
                aria-label={text("searchModels")}
                placeholder={text("searchModels")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div
                className="team-model-options"
                role="group"
                aria-label={text("model")}
              >
                <button
                  type="button"
                  aria-pressed={!value}
                  onClick={() => select("")}
                >
                  {text("modelDefault")}
                </button>
                {filtered.map((model) => (
                  <button
                    type="button"
                    key={model.id}
                    aria-pressed={value === model.id}
                    onClick={() => select(model.id)}
                  >
                    <strong>{model.label}</strong>
                    <small>{model.id}</small>
                  </button>
                ))}
                {!query.isFetching && !filtered.length && (
                  <small>{text("noModels")}</small>
                )}
              </div>
              {search.trim() &&
                !models.some((model) => model.id === search.trim()) && (
                  <Action onClick={() => select(search.trim())}>
                    {text("useModelId")} · {search.trim()}
                  </Action>
                )}
              <small>{text("manualModelHint")}</small>
            </>
          )}
          {query.data?.unavailableModels?.map((model) => (
            <small key={model.id}>
              {model.label} · {model.reason}
            </small>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
