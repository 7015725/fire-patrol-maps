import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api, type ManagedAdminUser } from "../../api/client";

export function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<ManagedAdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const { users: rows } = await api.listAdminUsers();
    setUsers(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : t("errorLoad"));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load, t]);

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const u = username.trim();
    if (!u || !password) return;
    await withBusy(async () => {
      await api.createAdminUser({ username: u, password });
      setUsername("");
      setPassword("");
    });
  }

  async function onToggleDisabled(user: ManagedAdminUser) {
    await withBusy(async () => {
      await api.updateAdminUser(user.id, { disabled: !user.disabled });
    });
  }

  if (error && !users) {
    return <p role="alert" className="error-text">{error}</p>;
  }

  if (!users) {
    return <p className="loading">{t("loading")}</p>;
  }

  const enabledCount = users.filter((u) => !u.disabled).length;

  return (
    <section className="admin-page">
      <div className="page-header">
        <h1>{t("users")}</h1>
        <p className="hint">{t("usersHint")}</p>
      </div>

      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}

      <form onSubmit={onCreate} className="row">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("username")}
          autoComplete="off"
          disabled={busy}
          className="input"
          style={{ flex: "1 1 140px", minWidth: 120 }}
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("password")}
          autoComplete="new-password"
          disabled={busy}
          className="input"
          style={{ flex: "1 1 140px", minWidth: 120 }}
          required
        />
        <button type="submit" disabled={busy || !username.trim() || !password} className="btn btn-primary">
          {t("createUser")}
        </button>
      </form>

      <ul className="list">
        {users.map((user) => {
          // Prevent locking out the last remaining enabled admin from the UI.
          const isLastEnabledAdmin = !user.disabled && enabledCount <= 1;
          return (
            <li key={user.id} className="list-item" style={{ justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{user.username}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-2)" }}>
                  {user.disabled ? t("disabled") : t("enabled")}
                  {isLastEnabledAdmin ? ` — ${t("lastAdminCannotDisable")}` : null}
                </div>
              </div>
              <button
                type="button"
                disabled={busy || isLastEnabledAdmin}
                onClick={() => onToggleDisabled(user)}
                title={isLastEnabledAdmin ? t("lastAdminCannotDisable") : undefined}
                className={user.disabled ? "btn btn-primary btn-sm" : "btn btn-sm btn-danger"}
              >
                {user.disabled ? t("enable") : t("disable")}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
