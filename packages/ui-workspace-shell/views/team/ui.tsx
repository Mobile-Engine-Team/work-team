import { ApiError, errorCode, dispatchReasonCode } from "@multica/core/api";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { sleep } from "@/app/lib/backoff";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { text } from "./client";
import { TeamNetworkError, isRecoverableTeamRead } from "./request-transport";
import { Combobox } from "@base-ui/react/combobox";
export { Input, Textarea };
export function SearchPicker({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Combobox.Root
      items={options}
      value={options.find((o) => o.value === value) || null}
      itemToStringLabel={(o) => o.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      onValueChange={(o) => {
        if (o) onChange(o.value);
      }}
      open={open}
      onOpenChange={setOpen}
    >
      <Combobox.Trigger
        className="team-select-trigger team-search-trigger"
        aria-label={label}
      >
        <span>{options.find((o) => o.value === value)?.label || label}</span>
        <span aria-hidden>⌄</span>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="team-search-positioner">
          <Combobox.Popup className="team-search-popup">
            <Combobox.Input
              aria-label={text("searchProject")}
              placeholder={text("searchProject")}
              className="team-search-input"
            />
            <Combobox.Empty>{text("noOptions")}</Combobox.Empty>
            <Combobox.List>
              {(o: { value: string; label: string }) => (
                <Combobox.Item
                  key={o.value}
                  value={o}
                  className="team-search-option"
                >
                  {o.label}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
export function Action({
  children,
  primary,
  ...props
}: React.ComponentProps<typeof Button> & { primary?: boolean }) {
  return (
    <Button
      variant={primary ? "default" : "outline"}
      className={primary ? "team-primary" : ""}
      {...props}
    >
      {children}
    </Button>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="team-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Picker({
  value,
  options,
  onChange,
  label,
  disabled,
  emptyLabel,
  selectedLabel,
}: {
  value: string;
  options: { value: string; label: string; disabled?: boolean }[];
  onChange: (v: string) => void;
  label: string;
  disabled?: boolean;
  emptyLabel?: string;
  selectedLabel?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v !== null) onChange(v);
      }}
      disabled={disabled}
    >
      <SelectTrigger className="team-select-trigger" aria-label={label}>
        <SelectValue>
          {selectedLabel || options.find((o) => o.value === value)?.label || label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="team-select-popup" align="start">
        {options.length === 0 && (
          <div className="team-picker-empty" role="status">
            {emptyLabel || text("noOptions")}
          </div>
        )}
        {options.map((o) => (
          <SelectItem
            className="team-select-option"
            key={o.value}
            value={o.value}
            disabled={o.disabled}
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide,
  className = "",
  focusClose = false,
}: {
  title: string;
  focusClose?: boolean;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const popup=useRef<HTMLDivElement>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent ref={popup} initialFocus={() => {
        const dialog = popup.current;
        if (dialog && !dialog.contains(document.activeElement)) {
          // Apply focus now. A deferred animation frame can otherwise steal
          // focus after the user has already moved to the second field.
          const first = Array.from(dialog.querySelectorAll<HTMLElement>(
            'input:not(:disabled):not([type="hidden"]), textarea:not(:disabled), select:not(:disabled), button:not(:disabled), a[href], [tabindex="0"]'
          )).find(el => el.tabIndex >= 0 && el.getClientRects().length > 0);
          const close = focusClose && dialog.querySelector<HTMLElement>('[data-slot="dialog-close"]');
          (close || first || dialog).focus({preventScroll:true});
        }
        return false;
      }}
        className={`${wide ? "team-modal team-modal-wide" : "team-modal"} ${className}`}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function Failure({
  error,
  retry,
  message,
}: {
  error: unknown;
  message?: string;
  retry?: () => void;
}) {
  if (!error) return null;
  const code = errorCode(error);
  const reason = dispatchReasonCode(error);
  const hint =
    error instanceof TeamNetworkError
      ? "networkUnavailable"
      : error instanceof Error &&
          /an agent named .+ already exists in this workspace/.test(
            error.message,
          )
        ? "agentNameConflict"
        : error instanceof Error &&
            error.message.includes("invitation already pending")
          ? "invitationPending"
          : error instanceof Error &&
              error.message === "TEAM_ENDPOINT_RESTART_REQUIRED"
            ? "modelReenableRequired"
            : error instanceof Error &&
                error.message === "TEAM_MODEL_AUTH_REQUIRED"
              ? "modelAuthRequired"
              : code === "daemon_version_unsupported"
                ? "daemonVersionUnsupported"
                : reason === "runtime_offline"
                  ? "runtimeOfflineError"
                  : reason === "agent_runtime_required"
                    ? "runtimeRequired"
                    : code === "agent_unavailable"
                      ? "agentUnavailable"
                      : "failedHint";
  return (
    <div role="alert" className="team-error">
      <strong>{text("failed")}</strong>
      <span>{message || text(hint)}</span>
      {retry && <Action onClick={retry}>{text("retry")}</Action>}
      <details>
        <summary>{text("diagnostics")}</summary>
        <pre>
          {error instanceof TeamNetworkError
            ? `${error.occurredAt} · ${error.method} · ${error.requestId}`
            : error instanceof ApiError
              ? `HTTP ${error.status}${code ? ` · ${code}` : ""}`
              : text("unknownError")}
        </pre>
      </details>
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="team-empty">{children}</div>;
}
export function Status({ value }: { value: string }) {
  const translated = text(`status.${value}`);
  return (
    <span className={`team-status team-status-${value}`}>
      {translated.startsWith("team.") ? value : translated}
    </span>
  );
}
export function Avatar({ name }: { name: string }) {
  return <span className="team-avatar">{name.slice(0, 1)}</span>;
}

export function PlanFailure({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  if (!error) return null;
  let message = text("project.networkFailure");
  if (error instanceof ApiError) {
    if (error.status === 401) message = text("project.sessionFailure");
    else if (error.status === 403) message = text("project.permissionFailure");
    else if ([400, 404, 409, 422].includes(error.status))
      message = error.message;
    else message = text("project.serviceFailure");
  }
  return (
    <div role="alert" className="team-error">
      <strong>{text("failed")}</strong>
      <span>{message}</span>
      <small>{text("project.editsRetained")}</small>
      {retry && <Action onClick={retry}>{text("retry")}</Action>}
    </div>
  );
}

// Short outages remain invisible; a persistent outage gets one quiet status,
// never an error screen. Query success removes it without remounting children.
export function TeamConnectionNotice() {
  const client = useQueryClient();
  const cache = client.getQueryCache();
  const recovering = useSyncExternalStore(
    (notify) => cache.subscribe(notify),
    () => cache.getAll().some((query) => query.isActive() && (
      isRecoverableTeamRead(query.state.fetchFailureReason) ||
      query.state.fetchStatus === "paused"
    )),
    () => false,
  );
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(false);
    if (!recovering) return;
    const controller = new AbortController();
    void sleep(10_000, controller.signal).then(() => setVisible(true), () => {});
    return () => controller.abort();
  }, [recovering]);
  return recovering && visible ? (
    <div role="status" className="team-connection-status">{text("connectionRestoring")}</div>
  ) : null;
}
