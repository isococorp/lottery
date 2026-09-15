import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [totalUsers, activeUsers, totalSessions, recentLogs] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.auditLog.count({ where: { timestamp: { gte: new Date(Date.now() - 86400_000) } } }),
  ]);

  const stats = [
    { label: "สมาชิกทั้งหมด", value: totalUsers },
    { label: "ใช้งานอยู่", value: activeUsers },
    { label: "Sessions ปัจจุบัน", value: totalSessions },
    { label: "Logs (24 ชม.)", value: recentLogs },
  ];

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-white">Admin Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card text-center">
            <div className="text-3xl font-bold text-gold">{s.value}</div>
            <div className="mt-1 text-sm text-white/60">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
