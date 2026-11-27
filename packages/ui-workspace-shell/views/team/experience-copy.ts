// Workbench-specific wording for per-account execution profiles.
export const experienceCopy: Record<string, { zh: string; en: string }> = {
  "project.noCandidates": {zh:"没有可加入的任务", en:"No matching tasks"},
  archiveAgent: {zh:"归档智能体", en:"Archive agent"},
  confirmArchiveAgent: {zh:"确认归档", en:"Confirm archive"},
  archivingAgent: {zh:"正在归档…", en:"Archiving…"},
  confirmArchiveName: {zh:"确定归档“{name}”吗？", en:"Archive “{name}”?"},
  replaceSquadLeader: {zh:"请先更换小队队长", en:"Replace the squad leader first"},
  replaceSquadLeaderHint: {zh:"“{name}”是以下小队的队长。请先在小队详情中指定另一位队长。", en:"“{name}” leads the following squads. Choose another leader in each squad first."},
  archiveSquadHint: {zh:"小队将从列表中移除，未完成任务转交给原队长。归档后不能恢复。", en:"The squad will leave the list and its unfinished tasks will transfer to its current leader. Archiving a squad is permanent."},
  archiveAgentHint: {
    zh:"归档后不能接收新任务，未完成任务将取消；历史记录保留，可在“已归档”中恢复。",
    en:"Archiving cancels unfinished assigned tasks and active or queued runs. History is retained. You can restore the agent from Archived.",
  },
  joinedWorkspaceUnavailable: {
    zh: "已接受邀请，暂时无法读取新工作区。请重试。",
    en: "The invitation was accepted. The new workspace is temporarily unavailable. Try again.",
  },
  modelAuthHint: {
    zh: "登录或导入仅授权当前账号在此客户端的执行端。该执行端上的 Codex 智能体共用这份授权。",
    en: "Signing in or importing authorizes this account’s execution endpoint on this client. Codex agents on this endpoint use that authorization.",
  },
  modelNotConfigured: {
    zh: "当前执行端尚未配置 Codex 授权。",
    en: "Codex authorization is missing for this execution endpoint.",
  },
  modelConfigured: {
    zh: "已检测到当前执行端的 Codex 授权。可通过测试确认模型可用性。",
    en: "Codex authorization was found for this endpoint. Use a model test to confirm availability.",
  },
  modelAuthorizationUnavailable: {
    zh: "暂时无法读取 Codex 授权状态，请刷新。",
    en: "The Codex authorization status is unavailable. Refresh to retry.",
  },
  modelAuthorizationOffline: {
    zh: "请先启用当前客户端的执行端，再配置 Codex 授权。",
    en: "Enable the execution endpoint on this client before configuring Codex authorization.",
  },
  modelCatalogSignInHint: {
    zh: "当前执行端尚未配置 Codex 授权。内置或备用模型目录仅供参考。",
    en: "Codex authorization is missing for this endpoint. The bundled or fallback catalog is for reference.",
  },
  modelCatalogAuthorized: {
    zh: "已检测到当前执行端的 Codex 授权。",
    en: "Codex authorization was found for this endpoint.",
  },
  modelCatalogCached: {
    zh: "模型目录来自所选执行端的上次发现结果。",
    en: "The catalog is cached from the selected endpoint’s previous discovery.",
  },
  modelCatalogEndpoint: {
    zh: "模型目录由所选执行端返回。调用权限以实际测试为准。",
    en: "The selected endpoint returned this catalog. A model test confirms access.",
  },
  modelCatalogRefreshFailed: {
    zh: "模型目录刷新失败，仍显示上次结果。",
    en: "The catalog refresh failed. The previous results are still shown.",
  },
};
