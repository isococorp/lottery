"use client";

import { useState, useEffect, FormEvent } from "react";

interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  createdBy?: { displayName: string; username: string } | null;
}

interface MeUser {
  id: string;
  role: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [me, setMe] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [tempPwd, setTempPwd] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  // Create form state
  const [newEmail, setNewEmail] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState("MEMBER");

  async function load() {
    const [usersRes, meRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/auth/me"),
    ]);
    if (usersRes.ok) {
      const data = await usersRes.json();
      setUsers(data.users);
    }
    if (meRes.ok) {
      const data = await meRes.json();
      setMe(data.user);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setTempPwd(null);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail,
        username: newUsername,
        displayName: newDisplayName,
        role: newRole,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }

    setTempPwd(data.tempPassword);
    setNewEmail("");
    setNewUsername("");
    setNewDisplayName("");
    setNewRole("MEMBER");
    load();
  }

  async function handleAction(userId: string, action: string, confirm: string) {
    if (!window.confirm(confirm)) return;
    setActionMsg("");

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: action === "delete" ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "delete" ? {} :
        action === "suspend" ? { status: "SUSPENDED" } :
        action === "activate" ? { status: "ACTIVE" } :
        action === "disable" ? { status: "DISABLED" } :
        { action },
      ),
    });
    const data = await res.json();

    if (!res.ok) {
      setActionMsg(`Error: ${data.error}`);
      return;
    }

    if (action === "reset-password" && data.tempPassword) {
      setTempPwd(data.tempPassword);
      setActionMsg("รีเซ็ตรหัสผ่านสำเร็จ — ดูรหัสผ่านชั่วคราวด้านบน");
    } else {
      setActionMsg("ดำเนินการสำเร็จ");
    }
    load();
  }

  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  if (loading) {
    return <div className="text-center text-white/50">กำลังโหลด...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">จัดการสมาชิก</h1>
        <button onClick={() => { setShowCreate(!showCreate); setTempPwd(null); }} className="btn text-sm">
          {showCreate ? "ปิด" : "+ เพิ่มสมาชิก"}
        </button>
      </div>

      {/* Temp password display */}
      {tempPwd && (
        <div className="card mb-6 border-gold/40">
          <div className="mb-2 text-sm font-semibold text-gold-light">
            รหัสผ่านชั่วคราว (แสดงครั้งเดียว — คัดลอกไปส่งให้สมาชิก)
          </div>
          <div className="flex items-center gap-3">
            <code className="rounded bg-navy px-4 py-2 text-lg font-bold text-gold">{tempPwd}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(tempPwd); setActionMsg("คัดลอกแล้ว"); }}
              className="btn-ghost text-xs"
            >
              คัดลอก
            </button>
          </div>
        </div>
      )}

      {actionMsg && (
        <div className="mb-4 rounded-lg border border-gold/20 bg-gold/5 px-4 py-2 text-sm text-gold-light">
          {actionMsg}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="card mb-6">
          <h2 className="mb-4 text-base font-semibold text-white">เพิ่มสมาชิกใหม่</h2>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-white/60">Email</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Username</label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">ชื่อที่แสดง</label>
              <input
                type="text"
                required
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
              >
                <option value="MEMBER">MEMBER</option>
                {isSuperAdmin && <option value="ADMIN">ADMIN</option>}
                {isSuperAdmin && <option value="SUPER_ADMIN">SUPER_ADMIN</option>}
              </select>
            </div>

            {error && (
              <div className="col-span-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="col-span-full">
              <button type="submit" className="btn text-sm">
                สร้างบัญชี (ระบบจะ generate รหัสผ่านชั่วคราว)
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr className="bg-navy/50">
              <th className="text-left">ชื่อผู้ใช้</th>
              <th className="text-left">อีเมล</th>
              <th>Role</th>
              <th>สถานะ</th>
              <th>เข้าสู่ระบบล่าสุด</th>
              <th>สร้างโดย</th>
              <th>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="font-medium text-white">{u.displayName}</div>
                  <div className="text-xs text-white/50">@{u.username}</div>
                </td>
                <td className="text-sm">{u.email}</td>
                <td className="text-center">
                  <span className={`badge ${u.role === "SUPER_ADMIN" ? "!border-red-400/40 !text-red-300" : u.role === "ADMIN" ? "!border-blue-400/40 !text-blue-300" : ""}`}>
                    {u.role}
                  </span>
                </td>
                <td className="text-center">
                  <span className={`text-xs font-semibold ${u.status === "ACTIVE" ? "text-green-400" : u.status === "SUSPENDED" ? "text-yellow-400" : "text-red-400"}`}>
                    {u.status}
                  </span>
                </td>
                <td className="text-center text-xs text-white/50">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("th-TH") : "—"}
                </td>
                <td className="text-center text-xs text-white/50">
                  {u.createdBy?.displayName ?? "—"}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {u.status === "ACTIVE" && (
                      <button
                        onClick={() => handleAction(u.id, "suspend", `ระงับบัญชี ${u.displayName}?`)}
                        className="rounded bg-yellow-500/20 px-2 py-1 text-xs text-yellow-300 hover:bg-yellow-500/30"
                      >
                        ระงับ
                      </button>
                    )}
                    {u.status === "SUSPENDED" && (
                      <button
                        onClick={() => handleAction(u.id, "activate", `เปิดใช้งาน ${u.displayName}?`)}
                        className="rounded bg-green-500/20 px-2 py-1 text-xs text-green-300 hover:bg-green-500/30"
                      >
                        เปิดใช้
                      </button>
                    )}
                    <button
                      onClick={() => handleAction(u.id, "force-logout", `บังคับ Logout ${u.displayName}?`)}
                      className="rounded bg-blue-500/20 px-2 py-1 text-xs text-blue-300 hover:bg-blue-500/30"
                    >
                      Logout
                    </button>
                    <button
                      onClick={() => handleAction(u.id, "reset-password", `Reset รหัสผ่าน ${u.displayName}?`)}
                      className="rounded bg-purple-500/20 px-2 py-1 text-xs text-purple-300 hover:bg-purple-500/30"
                    >
                      Reset PW
                    </button>
                    {isSuperAdmin && u.id !== me?.id && (
                      <button
                        onClick={() => handleAction(u.id, "delete", `ลบบัญชี ${u.displayName} ถาวร? การกระทำนี้ไม่สามารถย้อนกลับได้`)}
                        className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/30"
                      >
                        ลบ
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
