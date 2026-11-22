"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";

function AdminLoginContent() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const getTargetUrl = useCallback(() => {
    const nextParam = searchParams.get("next");
    if (nextParam && nextParam.startsWith("/admin") && nextParam !== "/admin/login") {
      return nextParam;
    }
    return "/admin/analytics";
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/admin/session")
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as { ok?: boolean };
        if (data.ok) router.replace(getTargetUrl());
      })
      .catch(() => {});
  }, [router, getTargetUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.replace(getTargetUrl());
        return;
      }

      const data = await res.json().catch(() => ({}));
      setError(data.error || "Invalid username or password");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-border bg-card p-8 shadow-[0_0_40px_rgba(0,0,0,0.2)]">
            <h1 className="text-2xl font-display font-semibold text-center mb-2 text-accent">
              Intent
            </h1>
            <p className="text-muted text-sm text-center mb-8 font-mono">
              Admin access
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="username"
                  className="block font-mono text-xs text-slate-400 uppercase tracking-wider mb-2"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border-2 border-border bg-slate-900/90 px-4 py-3 font-display text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 transition-colors"
                  placeholder="Enter username"
                  required
                  autoComplete="username"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block font-mono text-xs text-slate-400 uppercase tracking-wider mb-2"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border-2 border-border bg-slate-900/90 px-4 py-3 font-display text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 transition-colors"
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 font-mono">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-accent text-black font-semibold py-3 px-4 hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <Link
              href="/"
              className="mt-6 block text-center text-sm text-muted hover:text-accent transition-colors font-mono"
            >
              ← Back to Intent
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-background text-sm text-muted font-mono">Opening Intent Admin…</div>}>
      <AdminLoginContent />
    </Suspense>
  );
}
