"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function TestAISection() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch(`${API_URL}/api/initiate-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, "") }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || "Request failed");

      setStatus("success");
      setMessage("Call initiated! Our AI will reach out shortly.");
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Failed to initiate call. Ensure the FastAPI server is running."
      );
    }
  };

  return (
    <section
      id="test-ai"
      className="relative py-24 px-4 sm:px-6 lg:px-8"
    >
      <motion.div
        initial={{ opacity: 1, y: 0 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-2xl mx-auto text-center"
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-semibold">
          Test the <span className="text-accent">AI</span>
        </h2>
        <p className="mt-4 text-muted">
          Enter your phone number. Our AI agent will call you to demonstrate
          lead qualification in real time.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 flex flex-col sm:flex-row gap-4 max-w-md mx-auto"
        >
          <Input
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={status === "loading"}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={status === "loading"}
            className="drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] shrink-0"
          >
            {status === "loading" ? "Initiating..." : "Receive Call"}
          </Button>
        </form>

        {message && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 font-mono text-sm ${
              status === "success" ? "text-accent" : "text-red-400"
            }`}
          >
            {message}
          </motion.p>
        )}
      </motion.div>
    </section>
  );
}
