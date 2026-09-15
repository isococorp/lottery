"use client";

import { useRouter } from "next/navigation";

interface Props {
  user: { displayName: string; role: string } | null;
}

export function UserNav({ user }: Props) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="ml-2 rounded-lg border border-gold/40 px-3 py-1.5 text-sm text-gold-light transition hover:bg-gold/10"
      >
        เข้าสู่ระบบ
      </a>
    );
  }

  return (
    <div className="ml-2 flex items-center gap-2">
      <span className="text-xs text-white/50">{user.displayName}</span>
      <button
        onClick={handleLogout}
        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/5 hover:text-white"
      >
        ออกจากระบบ
      </button>
    </div>
  );
}
