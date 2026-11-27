// Workbench-specific wording for per-account execution profiles.
export const experienceCopy: Record<string, { zh: string; en: string }> = {
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
