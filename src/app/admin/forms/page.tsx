"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-header";

type FormSubmission = {
  id: string;
  name: string;
  email: string;
  phone: string;
  trade?: string;
  message?: string;
  source?: string;
  createdAt: string;
};

export default function AdminFormsPage() {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/inquiry/list", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        setSubmissions(data);
        setError(null);
      })
      .catch(() => setError("Failed to load submissions"))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const formatPhone = (p: string) => {
    const n = p.replace(/\D/g, "");
    if (n.length === 10) return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
    if (n.length === 11 && n[0] === "1") return `(${n.slice(1, 4)}) ${n.slice(4, 7)}-${n.slice(7)}`;
    return p;
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 bg-gradient-to-br from-[#00e5ff]/[0.03] via-transparent to-[#a78bfa]/[0.03] pointer-events-none z-0" aria-hidden />
      <AdminHeader />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 overflow-x-hidden min-w-0">
        <h2 className="text-2xl font-display font-semibold text-[#00e5ff] mb-8">
          Form Submissions
        </h2>

        {loading && (
          <div className="rounded-xl border-2 border-[#00e5ff]/30 bg-slate-900/60 p-12 text-center">
            <p className="text-slate-400 font-mono">Loading…</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-6 text-amber-200">
            {error}
          </div>
        )}

        {!loading && !error && submissions.length === 0 && (
          <div className="rounded-xl border-2 border-[#00e5ff]/30 bg-slate-900/60 p-12 text-center">
            <p className="text-slate-400 font-mono">No submissions yet.</p>
            <p className="mt-2 text-slate-500 text-sm">Submissions from the Get a Free Quote form will appear here.</p>
          </div>
        )}

        {!loading && !error && submissions.length > 0 && (
          <div className="space-y-4">
            {submissions.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border-2 border-[#00e5ff]/30 bg-slate-900/60 p-6 hover:border-[#00e5ff]/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-display font-semibold text-white">{s.name}</h3>
                    <p className="text-sm text-slate-400 mt-1">{s.email}</p>
                    <p className="text-sm text-slate-400">{formatPhone(s.phone)}</p>
                    {s.trade && (
                      <span className="inline-block mt-2 px-2 py-1 rounded text-xs font-mono bg-[#00e5ff]/20 text-[#00e5ff]">
                        {s.trade}
                      </span>
                    )}
                  </div>
                  <div className="text-right text-sm text-slate-500 font-mono shrink-0">
                    {formatDate(s.createdAt)}
                  </div>
                </div>
                {s.message && (
                  <p className="mt-4 pt-4 border-t border-slate-700/50 text-slate-300 text-sm leading-relaxed">
                    {s.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8 px-4 mt-16">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center shrink-0 text-slate-400 hover:text-[#00e5ff] transition-colors">
            <span className="font-mono text-sm">← Intent</span>
          </Link>
          <p className="text-slate-500 text-sm font-mono">Intent Admin Hub • Internal Use Only</p>
        </div>
      </footer>
    </div>
  );
}
