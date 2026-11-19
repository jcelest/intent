"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui/logo";

function workspacePath() {
  if (typeof window === "undefined") return "/admin/dialer";
  const host = window.location.hostname;
  return host === "call.intentrev.net" || host.startsWith("call.localhost") ? "/" : "/admin/dialer";
}

function LoginBrandMark() {
  return <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#159ed8] to-[#1266c4] shadow-[0_8px_24px_rgba(18,102,196,.25)]"><Logo className="!h-10 sm:!h-10 [&>img]:brightness-0 [&>img]:invert [&>img]:drop-shadow-none"/></span>;
}

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/session")
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { ok?: boolean };
        if (data.ok) router.replace(workspacePath());
      })
      .catch(() => {});
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (response.ok) {
        router.replace(workspacePath());
        return;
      }
      const data = await response.json().catch(() => ({}));
      setError(data.error || "Invalid username or password.");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative grid min-h-[100dvh] overflow-hidden bg-[#f4f6f3] px-4 py-8 text-[#17211d] sm:place-items-center sm:px-6">
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#b8d9f5]/55 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-[#dceafa]/75 blur-3xl" />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_30px_90px_rgba(24,48,39,.12)] sm:min-h-[650px] lg:grid lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#123b70] via-[#14579a] to-[#1266c4] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-20 top-20 h-64 w-64 rounded-full border border-white/10" />
          <div className="absolute -right-6 top-36 h-64 w-64 rounded-full border border-white/10" />
          <div className="relative flex items-center gap-3"><LoginBrandMark/><div><div className="font-bold">Intent Dialer</div><div className="text-[10px] uppercase tracking-[.2em] text-white/50">Private workspace</div></div></div>
          <div className="relative"><div className="mb-5 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-[#c6e2fa]">Built for focused conversations</div><h1 className="max-w-md text-5xl font-bold leading-[1.04] tracking-[-.05em]">Move through your list. Keep every follow-up.</h1><p className="mt-5 max-w-md text-base leading-7 text-white/60">One call at a time, with the context and guardrails your team needs.</p></div>
          <div className="relative grid grid-cols-3 gap-3">{[["1", "call at a time"], ["Live", "team activity"], ["Built-in", "DNC controls"]].map(([value, label]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[.06] p-4"><div className="font-bold text-[#d4e9fb]">{value}</div><div className="mt-1 text-xs text-white/45">{label}</div></div>)}</div>
        </section>

        <section className="flex flex-1 items-center p-5 sm:p-10 lg:p-14">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-10 flex items-center gap-3 lg:hidden"><LoginBrandMark/><div><div className="font-bold">Intent Dialer</div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#83908a]">Private workspace</div></div></div>
            <div className="text-[10px] font-bold uppercase tracking-[.22em] text-[#1266c4]">Welcome back</div>
            <h1 className="mt-2 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Sign in to call.</h1>
            <p className="mt-3 text-sm leading-6 text-[#748079]">Use your private Intent workspace credentials.</p>
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block"><span className="mb-2 block text-xs font-semibold text-[#53615a]">Username</span><input autoFocus id="username" type="text" value={username} onChange={(event) => setUsername(event.target.value)} className="min-h-12 w-full rounded-xl border border-[#d7ddd8] bg-[#fafbf9] px-4 text-base outline-none transition placeholder:text-[#a3aaa6] focus:border-[#5d9bd3] focus:bg-white focus:ring-4 focus:ring-[#d9eaf8]/70" placeholder="Enter username" required autoComplete="username" /></label>
              <label className="block"><span className="mb-2 block text-xs font-semibold text-[#53615a]">Password</span><input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-12 w-full rounded-xl border border-[#d7ddd8] bg-[#fafbf9] px-4 text-base outline-none transition placeholder:text-[#a3aaa6] focus:border-[#5d9bd3] focus:bg-white focus:ring-4 focus:ring-[#d9eaf8]/70" placeholder="Enter password" required autoComplete="current-password" /></label>
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
              <button type="submit" disabled={loading} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#1266c4] px-4 text-sm font-bold text-white shadow-lg shadow-blue-700/15 transition hover:bg-[#0f57aa] disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Signing in..." : "Open workspace"}</button>
            </form>
            <p className="mt-8 text-center text-[11px] leading-5 text-[#919a95]">Authorized team members only. Calling activity is logged to your workspace.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
