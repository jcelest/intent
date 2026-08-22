"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { InquiryType } from "@/lib/form-store";

const TRADES = [
  "HVAC",
  "Plumbing",
  "Roofing",
  "Electrical",
  "General Contractor",
  "Landscaping",
  "Solar",
  "Other",
];

const MONTHLY_JOBS = [
  "Under 5",
  "5–10",
  "10–15",
  "15–30",
  "30+",
];

const ANNUAL_REVENUE = [
  "Under $25k",
  "$25k–$50k",
  "$50k–$100k",
  "$100k–$250k",
  "$250k+",
];

const REVIEW_COUNTS = [
  "Under 10",
  "10–25",
  "25–50",
  "50–100",
  "100+",
];

const MARKETING_BUDGETS = [
  "Not investing yet",
  "$500–$1,500/mo",
  "$1,500–$3,000/mo",
  "$3,000–$5,000/mo",
  "$5,000+/mo",
];

const YEARS_IN_BUSINESS = [
  "Less than 1 year",
  "1–2 years",
  "2–5 years",
  "5–10 years",
  "10+ years",
];

const selectClassName =
  "w-full rounded-lg border-2 border-border bg-card px-4 py-3 font-display text-foreground focus:outline-none focus:border-accent/50";

export function InquiryFormSection() {
  const [inquiryType, setInquiryType] = useState<InquiryType>("partnership");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [trade, setTrade] = useState("");
  const [monthlyJobs, setMonthlyJobs] = useState("");
  const [annualRevenue, setAnnualRevenue] = useState("");
  const [reviewCount, setReviewCount] = useState("");
  const [marketingBudget, setMarketingBudget] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.replace(/\D/g, ""),
          trade: trade || undefined,
          message: message.trim() || undefined,
          inquiryType,
          monthlyJobs: monthlyJobs || undefined,
          annualRevenue: annualRevenue || undefined,
          reviewCount: reviewCount || undefined,
          marketingBudget: marketingBudget || undefined,
          yearsInBusiness: yearsInBusiness || undefined,
          source: typeof window !== "undefined" ? window.location.pathname || "home" : "home",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setStatus("success");
      setName("");
      setEmail("");
      setPhone("");
      setTrade("");
      setMonthlyJobs("");
      setAnnualRevenue("");
      setReviewCount("");
      setMarketingBudget("");
      setYearsInBusiness("");
      setMessage("");
      setInquiryType("partnership");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to submit. Please try again.");
    }
  };

  return (
    <section
      id="get-in-touch"
      className="relative py-24 px-4 sm:px-6 lg:px-8"
    >
      <motion.div
        initial={{ opacity: 1, y: 0 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-xl mx-auto"
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-semibold text-center">
          {inquiryType === "launchpad" ? (
            <>
              Start <span className="text-accent">Launchpad</span>
            </>
          ) : (
            <>
              Apply for <span className="text-accent">Partnership</span>
            </>
          )}
        </h2>
        <p className="mt-4 text-muted text-center">
          {inquiryType === "launchpad"
            ? "Tell us where you are today. We'll build your review and intake foundation toward full partnership."
            : "Tell us about your business. We'll assess fit and map how we grow your revenue."}
        </p>

        {status === "success" ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 rounded-xl border-2 border-accent/50 bg-accent/10 p-8 text-center"
          >
            <p className="text-accent font-semibold text-lg">
              Thanks! We&apos;ll be in touch soon.
            </p>
            <p className="mt-2 text-muted text-sm">
              We typically respond within 24 hours.
            </p>
            {inquiryType === "launchpad" ? (
              <p className="mt-4 text-sm">
                <Link
                  href="/begin?path=launchpad"
                  className="text-accent hover:underline"
                >
                  Ready to start? Begin Launchpad
                </Link>
              </p>
            ) : null}
          </motion.div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-10 space-y-5"
          >
            <div>
              <p className="font-mono text-xs text-muted uppercase tracking-wider mb-3">
                I&apos;m applying for
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setInquiryType("partnership")}
                  disabled={status === "loading"}
                  className={cn(
                    "rounded-lg border-2 px-4 py-3 text-sm font-display font-medium transition-colors",
                    inquiryType === "partnership"
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-card text-foreground/80 hover:border-accent/40"
                  )}
                >
                  Full Partnership
                </button>
                <button
                  type="button"
                  onClick={() => setInquiryType("launchpad")}
                  disabled={status === "loading"}
                  className={cn(
                    "rounded-lg border-2 px-4 py-3 text-sm font-display font-medium transition-colors",
                    inquiryType === "launchpad"
                      ? "border-amber-400/60 bg-amber-500/10 text-amber-200"
                      : "border-border bg-card text-foreground/80 hover:border-amber-400/40"
                  )}
                >
                  Intent Launchpad
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="inquiry-name" className="block font-mono text-xs text-muted uppercase tracking-wider mb-2">
                Name *
              </label>
              <Input
                id="inquiry-name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={status === "loading"}
                required
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="inquiry-email" className="block font-mono text-xs text-muted uppercase tracking-wider mb-2">
                Email *
              </label>
              <Input
                id="inquiry-email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "loading"}
                required
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="inquiry-phone" className="block font-mono text-xs text-muted uppercase tracking-wider mb-2">
                Phone *
              </label>
              <Input
                id="inquiry-phone"
                type="tel"
                placeholder="(555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={status === "loading"}
                required
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="inquiry-trade" className="block font-mono text-xs text-muted uppercase tracking-wider mb-2">
                Trade / Service
              </label>
              <select
                id="inquiry-trade"
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                disabled={status === "loading"}
                className={selectClassName}
              >
                <option value="">Select your trade</option>
                {TRADES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="inquiry-jobs" className="block font-mono text-xs text-muted uppercase tracking-wider mb-2">
                  Monthly jobs completed
                </label>
                <select
                  id="inquiry-jobs"
                  value={monthlyJobs}
                  onChange={(e) => setMonthlyJobs(e.target.value)}
                  disabled={status === "loading"}
                  className={selectClassName}
                >
                  <option value="">Select range</option>
                  {MONTHLY_JOBS.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="inquiry-revenue" className="block font-mono text-xs text-muted uppercase tracking-wider mb-2">
                  Annual revenue
                </label>
                <select
                  id="inquiry-revenue"
                  value={annualRevenue}
                  onChange={(e) => setAnnualRevenue(e.target.value)}
                  disabled={status === "loading"}
                  className={selectClassName}
                >
                  <option value="">Select range</option>
                  {ANNUAL_REVENUE.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="inquiry-reviews" className="block font-mono text-xs text-muted uppercase tracking-wider mb-2">
                  Google Reviews
                </label>
                <select
                  id="inquiry-reviews"
                  value={reviewCount}
                  onChange={(e) => setReviewCount(e.target.value)}
                  disabled={status === "loading"}
                  className={selectClassName}
                >
                  <option value="">Select range</option>
                  {REVIEW_COUNTS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="inquiry-budget" className="block font-mono text-xs text-muted uppercase tracking-wider mb-2">
                  Marketing budget
                </label>
                <select
                  id="inquiry-budget"
                  value={marketingBudget}
                  onChange={(e) => setMarketingBudget(e.target.value)}
                  disabled={status === "loading"}
                  className={selectClassName}
                >
                  <option value="">Select range</option>
                  {MARKETING_BUDGETS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="inquiry-years" className="block font-mono text-xs text-muted uppercase tracking-wider mb-2">
                Years in business
              </label>
              <select
                id="inquiry-years"
                value={yearsInBusiness}
                onChange={(e) => setYearsInBusiness(e.target.value)}
                disabled={status === "loading"}
                className={selectClassName}
              >
                <option value="">Select range</option>
                {YEARS_IN_BUSINESS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="inquiry-message" className="block font-mono text-xs text-muted uppercase tracking-wider mb-2">
                Message
              </label>
              <textarea
                id="inquiry-message"
                rows={4}
                placeholder={
                  inquiryType === "launchpad"
                    ? "What's holding you back from full partnership today?"
                    : "Tell us about your business, territory, and growth goals..."
                }
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={status === "loading"}
                className="w-full rounded-lg border-2 border-border bg-card px-4 py-3 font-display text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent/50 resize-none"
              />
            </div>

            {errorMessage && (
              <p className="text-red-400 text-sm font-mono">{errorMessage}</p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={status === "loading"}
              className="w-full drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]"
            >
              {status === "loading"
                ? "Submitting..."
                : inquiryType === "launchpad"
                  ? "Apply for Launchpad"
                  : "Apply for Partnership"}
            </Button>
          </form>
        )}
      </motion.div>
    </section>
  );
}
