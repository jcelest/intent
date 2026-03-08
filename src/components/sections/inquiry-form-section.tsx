"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

export function InquiryFormSection() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [trade, setTrade] = useState("");
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
      setMessage("");
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
          Get a <span className="text-accent">Free Quote</span>
        </h2>
        <p className="mt-4 text-muted text-center">
          Tell us about your business. We&apos;ll show you how we engineer revenue for contractors and the trades.
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
          </motion.div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-10 space-y-5"
          >
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
                className="w-full rounded-lg border-2 border-border bg-card px-4 py-3 font-display text-foreground focus:outline-none focus:border-accent/50"
              >
                <option value="">Select your trade</option>
                {TRADES.map((t) => (
                  <option key={t} value={t}>
                    {t}
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
                placeholder="Tell us about your business and goals..."
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
              {status === "loading" ? "Submitting..." : "Get My Free Quote"}
            </Button>
          </form>
        )}
      </motion.div>
    </section>
  );
}
