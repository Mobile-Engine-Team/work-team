import type { ReactNode } from "react";
import { Action, Modal } from "./ui";

export function SettingsRow({
  title,
  description,
  action = false,
  children,
}: {
  title: string;
  description?: string;
  action?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={
        action ? "mw-settings-row mw-settings-action" : "mw-settings-row"
      }
    >
      <div>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
      <div className="mw-setting-control">{children}</div>
    </div>
  );
}
export function SettingsInfo({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <Modal title={title} onClose={close}>
      <div>{children}</div>
      <div className="team-actions">
        <Action onClick={close}>关闭</Action>
      </div>
    </Modal>
  );
}
