"use client";

import { useState, useEffect } from "react";

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string;
  userAgent: string;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  severity: string;
  user: { displayName: string; email: string } | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  DEBUG: "text-white/40",
  INFO: "text-blue-300",
  WARNING: "text-yellow-300",
  ERROR: "text-red-300",
  CRITICAL: "text-red-500 font-bold",
};

const ACTIONS = [
  "LOGIN_SUCCESS", "LOGIN_FAILED", "LOGOUT", "ACCOUNT_LOCKED",
  "PASSWORD_CHANGED", "PASSWORD_RESET_BY_ADMIN",
  "USER_CREATE", "USER_UPDATE", "USER_STATUS_CHANGE", "ROLE_CHANGE",
  "USER_DELETE", "FORCE_LOGOUT", "VIEW_AUDIT_LOG", "EXPORT_DATA",
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  // Filters
  const [action, setAction] = useState("");
  const [severity, setSeverity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load(page = 1) {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", "50");
    if (action) params.set("action", action);
    if (severity) params.set("severity", severity);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const res = await fetch(`/api/admin/logs?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleFilter() {
    load(1);
  }

  function exportCSV() {
    const headers = ["timestamp", "action", "severity", "actorEmail", "ipAddress", "method", "path", "statusCode", "targetType", "targetId"];
    const rows = logs.map((l) =>
      headers.map((h) => {
        const val = l[h as keyof AuditLogEntry];
        return typeof val === "string" ? `"${val.replace(/"/g, '""')}"` : val ?? "";
      }).join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Audit Logs</h1>
        <button onClick={exportCSV} className="btn-ghost text-sm">
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs text-white/60">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
            >
              <option value="">ทั้งหมด</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
            >
              <option value="">ทั้งหมด</option>
              {["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">จาก</label>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">ถึง</label>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="flex items-end">
            <button onClick={handleFilter} className="btn w-full text-sm">
              ค้นหา
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-white/50">กำลังโหลด...</div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr className="bg-navy/50">
                  <th className="text-left">เวลา</th>
                  <th className="text-left">ผู้กระทำ</th>
                  <th className="text-left">Action</th>
                  <th>Severity</th>
                  <th>IP</th>
                  <th>Path</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="cursor-pointer" onClick={() => setSelected(log)}>
                    <td className="whitespace-nowrap text-xs">
                      {new Date(log.timestamp).toLocaleString("th-TH")}
                    </td>
                    <td className="text-sm">
                      {log.user?.displayName ?? log.actorEmail ?? "—"}
                    </td>
                    <td>
                      <span className="rounded bg-white/5 px-2 py-0.5 text-xs font-medium text-gold-light">
                        {log.action}
                      </span>
                    </td>
                    <td className={`text-center text-xs font-semibold ${SEVERITY_COLORS[log.severity] ?? ""}`}>
                      {log.severity}
                    </td>
                    <td className="text-center text-xs text-white/50">{log.ipAddress}</td>
                    <td className="text-xs text-white/50">{log.path ?? "—"}</td>
                    <td className="text-center text-xs">{log.statusCode ?? "—"}</td>
                    <td>
                      <button className="text-xs text-gold-light/60 hover:text-gold-light">
                        ดูเพิ่ม
                      </button>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-white/40">
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-sm text-white/50">
            <span>
              แสดง {logs.length} จาก {pagination.total} รายการ (หน้า {pagination.page}/{pagination.totalPages})
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => load(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="btn-ghost px-3 py-1 text-xs disabled:opacity-30"
              >
                ก่อนหน้า
              </button>
              <button
                onClick={() => load(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="btn-ghost px-3 py-1 text-xs disabled:opacity-30"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </>
      )}

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="card max-h-[80vh] w-full max-w-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gold-light">
                Log Detail — {selected.action}
              </h3>
              <button onClick={() => setSelected(null)} className="text-white/50 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <Row label="ID" value={selected.id} />
              <Row label="เวลา" value={new Date(selected.timestamp).toLocaleString("th-TH")} />
              <Row label="ผู้กระทำ" value={selected.user?.displayName ?? selected.actorEmail ?? "—"} />
              <Row label="Action" value={selected.action} />
              <Row label="Severity" value={selected.severity} />
              <Row label="IP" value={selected.ipAddress} />
              <Row label="User Agent" value={selected.userAgent} />
              <Row label="Method" value={selected.method ?? "—"} />
              <Row label="Path" value={selected.path ?? "—"} />
              <Row label="Status Code" value={String(selected.statusCode ?? "—")} />
              <Row label="Target" value={selected.targetType ? `${selected.targetType} #${selected.targetId}` : "—"} />

              {selected.beforeState && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-white/60">Before State:</div>
                  <pre className="overflow-x-auto rounded-lg bg-navy/60 p-3 text-xs text-white/80">
                    {JSON.stringify(selected.beforeState, null, 2)}
                  </pre>
                </div>
              )}
              {selected.afterState && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-white/60">After State:</div>
                  <pre className="overflow-x-auto rounded-lg bg-navy/60 p-3 text-xs text-white/80">
                    {JSON.stringify(selected.afterState, null, 2)}
                  </pre>
                </div>
              )}
              {selected.metadata && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-white/60">Metadata:</div>
                  <pre className="overflow-x-auto rounded-lg bg-navy/60 p-3 text-xs text-white/80">
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-28 shrink-0 text-white/50">{label}</span>
      <span className="text-white/90 break-all">{value}</span>
    </div>
  );
}
