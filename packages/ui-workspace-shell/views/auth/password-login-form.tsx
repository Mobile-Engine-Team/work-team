import { useState } from "react";
import { t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const errors: Record<string, string> = {
  username_taken: "team.demoUsernameTaken",
  invalid_credentials: "team.demoInvalidCredentials",
  invalid_credentials_format: "team.demoCredentialsHint",
  server_unreachable: "team.demoServerUnavailable",
};
export function PasswordLoginForm({
  loginWithPassword,
}: {
  loginWithPassword: (
    mode: "login" | "register",
    username: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="mt-5 w-full text-[var(--mw-login-text)]">
      <h1 className="text-[22px] font-semibold leading-[30px]">
        {t(mode === "login" ? "team.demoLogin" : "team.demoRegister")}
      </h1>
      <p className="mb-5 mt-2 text-[13px] leading-[21px] text-[var(--mw-login-muted)]">
        {t("team.demoLoginHint")}
      </p>
      <form
        className="flex w-full flex-col gap-3.5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          if (mode === "register" && password !== confirm) {
            setError(t("team.demoPasswordMismatch"));
            return;
          }
          setBusy(true);
          setError("");
          try {
            const result = await loginWithPassword(mode, username, password);
            if (!result.ok)
              setError(t(errors[result.error || ""] || "team.demoLoginFailed"));
            else setPassword("");
          } catch {
            setError(t("team.demoServerUnavailable"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="flex flex-col gap-1.5 text-[13px] leading-5">
          <span>{t("team.demoUsername")}</span>
          <Input
            className="h-11 rounded-lg px-3.5 text-sm placeholder:text-[var(--mw-login-muted)]"
            style={{
              background: "var(--mw-login-field)",
              color: "var(--mw-login-text)",
              borderColor: "var(--mw-login-border)",
            }}
            required
            autoFocus
            placeholder={t("team.demoUsernamePlaceholder")}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            minLength={2}
            maxLength={40}
            pattern="[a-zA-Z0-9][a-zA-Z0-9_.\-]{1,39}"
            disabled={busy}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] leading-5">
          <span>{t("team.demoPassword")}</span>
          <Input
            className="h-11 rounded-lg px-3.5 text-sm placeholder:text-[var(--mw-login-muted)]"
            style={{
              background: "var(--mw-login-field)",
              color: "var(--mw-login-text)",
              borderColor: "var(--mw-login-border)",
            }}
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("team.demoPasswordPlaceholder")}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            minLength={8}
            maxLength={72}
            disabled={busy}
          />
        </label>
        {mode === "register" && (
          <label className="flex flex-col gap-1.5 text-[13px] leading-5">
            <span>{t("team.demoConfirmPassword")}</span>
            <Input
              className="h-11 rounded-lg px-3.5 text-sm placeholder:text-[var(--mw-login-muted)]"
              style={{
                background: "var(--mw-login-field)",
                color: "var(--mw-login-text)",
                borderColor: "var(--mw-login-border)",
              }}
              required
              type="password"
              placeholder={t("team.demoConfirmPlaceholder")}
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              disabled={busy}
            />
          </label>
        )}
        <p className="text-xs leading-[19px] text-[var(--mw-login-muted)]">
          {t("team.demoCredentialsHint")}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="h-auto w-full rounded-[10px] py-3.5 text-[17px] font-normal leading-6 hover:brightness-105"
          style={{
            background: "var(--mw-login-action-gradient)",
            color: "var(--mw-login-action-text)",
          }}
          disabled={busy}
        >
          {t(
            busy
              ? "team.working"
              : mode === "login"
                ? "team.demoLogin"
                : "team.demoRegisterAndLogin",
          )}
        </Button>
      </form>
      <Button
        variant="ghost"
        className="mt-3 w-full text-sm text-[var(--mw-brand)] hover:text-[var(--mw-brand-dark)]"
        disabled={busy}
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError("");
          setPassword("");
          setConfirm("");
        }}
      >
        {t(mode === "login" ? "team.demoGoRegister" : "team.demoGoLogin")}
      </Button>
    </section>
  );
}
