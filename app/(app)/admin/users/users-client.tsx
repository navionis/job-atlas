"use client";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, UserMinus } from "lucide-react";
import { Spinner } from "../../../../components/loader";

type AdminUser = { email: string; admin: boolean; viaEnv: boolean; marked: number };

export default function UsersClient({ users: initialUsers, me }: { users: AdminUser[]; me: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [busy, setBusy] = useState<string[]>([]);
  const setUserAdmin = (email: string, admin: boolean) => {
    setBusy((b) => [...b, email]);
    void fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, admin }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw Error(d?.error || "Could not update admins");
        if (d.users) setUsers(d.users);
        toast.success(admin ? `${email} is now an admin` : `Admin revoked for ${email}`);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not update admins"))
      .finally(() => setBusy((b) => b.filter((x) => x !== email)));
  };
  return (
    <>
      <div className="pf-card">
        <p className="pf-hint">
          Signed-in Google accounts. The first verified sign-in holds the admin seat; grant or revoke additional admins
          here. Env-listed admins can only be removed via ADMIN_EMAILS. {users.length} users.
        </p>
        <div className="pf-resumes">
          {users.map((u) => (
            <div className="resume-row" key={u.email}>
              <span className={"resume-icon" + (u.admin ? " rank-badge" : "")}>{u.admin ? "A" : "U"}</span>
              <div className="resume-meta">
                <b>
                  {u.email}
                  {u.email === me && <span className="pill">you</span>}
                </b>
                <small>
                  {u.marked} jobs marked · {u.admin ? (u.viaEnv ? "admin via ADMIN_EMAILS" : "admin") : "member"}
                </small>
              </div>
              {u.admin ? (
                <button
                  className="src-toggle"
                  disabled={busy.includes(u.email) || u.viaEnv || u.email === me}
                  onClick={() => setUserAdmin(u.email, false)}
                  title={
                    u.viaEnv ? "Granted via ADMIN_EMAILS" : u.email === me ? "Cannot revoke yourself" : "Revoke admin"
                  }
                >
                  {busy.includes(u.email) ? <Spinner size={11} /> : <UserMinus size={11} />}
                  Revoke admin
                </button>
              ) : (
                <button
                  className="src-toggle off"
                  disabled={busy.includes(u.email)}
                  onClick={() => setUserAdmin(u.email, true)}
                >
                  {busy.includes(u.email) ? <Spinner size={11} /> : <UserPlus size={11} />}
                  Make admin
                </button>
              )}
            </div>
          ))}
          {users.length === 0 && <p className="pf-hint">No users yet.</p>}
        </div>
      </div>
    </>
  );
}
