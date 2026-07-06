"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

const QUALIFICATION_CRITERIA = [
  {
    title: "Volume & revenue",
    description:
      "5+ completed jobs per month or $25k+ in annual revenue. We target operators who are building—not coasting. The lower your starting point, the more room to grow—and the sharper the before-and-after looks on our side.",
  },
  {
    title: "Phone-first operations",
    description:
      "Inbound calls and fast follow-up drive your bookings. You answer—or you know every missed call costs a job.",
  },
  {
    title: "Google Reviews",
    description:
      "An active Google Business Profile with real Google reviews—not Yelp, not Facebook, not word of mouth alone. Rating, count, and recency on Google are what homeowners check before they call.",
  },
  {
    title: "Defined territory",
    description:
      "A focused service area you can actually cover—not a statewide listing with no trucks to back it up.",
  },
  {
    title: "Growth investment",
    description:
      "Budget and owner commitment to invest in marketing, software, and systems—not just hope for referrals.",
  },
  {
    title: "Full business access",
    description:
      "You're willing to let us into your business email, CRM, scheduling software, ad accounts, and the tools you run on. We need to be inside the operation to facilitate real change—not advise from the sidelines.",
  },
  {
    title: "Owner in the fight",
    description:
      "The decision-maker is engaged—ready to implement, review numbers, and move when the data says move.",
  },
];

const LAUNCHPAD_SERVICES = [
  {
    title: "Post-job Google review engine",
    description:
      "Automated SMS or email sent the moment a job closes—one tap straight to your Google review link. No chasing customers weeks later on the wrong platform.",
    highlight: true,
  },
  {
    title: "Google Business Profile build-out",
    description:
      "Photos, categories, service areas, and posting cadence—so you look like the operator homeowners trust before they call.",
    highlight: false,
  },
  {
    title: "Intake basics",
    description:
      "Missed-call text-back, after-hours capture, and a simple lead form—so you stop bleeding jobs before you scale.",
    highlight: false,
  },
  {
    title: "Qualification milestones",
    description:
      "Monthly scorecard tracking review velocity, response time, and job volume. Graduate to full Intent partnership when you hit the bar.",
    highlight: false,
  },
];

const container = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export function ClientQualificationSection() {
  return (
    <section
      id="client-qualification"
      className="relative py-24 px-4 sm:px-6 lg:px-8 border-t border-border/50"
      aria-labelledby="qualification-heading"
    >
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto"
        >
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
            Selective Partnership
          </p>
          <h2
            id="qualification-heading"
            className="mt-4 text-3xl sm:text-4xl font-display font-semibold text-foreground"
          >
            We only take clients we can{" "}
            <span className="text-accent">guarantee results for</span>
          </h2>
          <p className="mt-6 text-foreground/90 text-base sm:text-lg leading-relaxed">
            Intent is not a volume agency. We qualify every contractor before a
            partnership starts—because our reputation rides on yours. We lean toward
            operators who are early in the curve: more runway to grow, stronger proof
            when we deliver. If you meet the bar, we go all in. If you&apos;re not there
            yet, we have a path to get you there.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mt-14 grid gap-4 sm:grid-cols-2"
        >
          {QUALIFICATION_CRITERIA.map((criterion, i) => (
            <motion.div
              key={criterion.title}
              variants={item}
              className="flex items-start gap-4 rounded-xl border border-border/60 bg-card/50 px-5 py-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 font-mono text-sm text-accent">
                {i + 1}
              </span>
              <div>
                <h3 className="font-display font-semibold text-foreground">
                  {criterion.title}
                </h3>
                <p className="mt-1 text-sm text-foreground/80 leading-relaxed">
                  {criterion.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-14 grid gap-6 sm:grid-cols-2"
        >
          <div className="rounded-xl border-2 border-accent/40 bg-accent/5 p-6 sm:p-8">
            <h3 className="text-xl font-display font-semibold text-accent">
              Qualified — full partnership
            </h3>
            <p className="mt-3 text-foreground/90 text-sm leading-relaxed">
              Revenue engineering, custom software, organic search dominance, paid
              amplification, and ongoing optimization. The complete Intent package
              for operators ready to take market share from legacy competitors.
            </p>
            <Link
              href="/#get-in-touch"
              className="mt-5 inline-block font-mono text-sm text-accent hover:underline"
            >
              Apply for partnership →
            </Link>
          </div>
          <div className="rounded-xl border-2 border-border bg-card/50 p-6 sm:p-8">
            <h3 className="text-xl font-display font-semibold text-foreground">
              Not there yet — that&apos;s okay
            </h3>
            <p className="mt-3 text-foreground/90 text-sm leading-relaxed">
              Newer businesses, a thin Google review profile, or limited intake
              infrastructure don&apos;t disqualify you forever. They mean you need a
              runway first—not a full growth engine you can&apos;t fuel yet.
            </p>
            <Link
              href="/#intent-launchpad"
              className="mt-5 inline-block font-mono text-sm text-muted hover:text-accent transition-colors"
            >
              See Intent Launchpad →
            </Link>
          </div>
        </motion.div>

        <motion.div
          id="intent-launchpad"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20 rounded-xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-600/20 via-amber-900/40 to-amber-950/60 p-6 sm:p-10 shadow-[0_0_48px_rgba(217,169,65,0.12)]"
        >
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-200/90">
            Path to qualification
          </p>
          <h3 className="mt-3 text-2xl sm:text-3xl font-display font-semibold text-amber-100">
            Intent Launchpad
          </h3>
          <p className="mt-4 max-w-2xl text-amber-100/85 text-base leading-relaxed">
            A focused service for contractors building toward full partnership. We
            install the Google review and intake foundation legacy shops took decades
            to accumulate—starting with Google reviews captured right after every job.
          </p>

          <motion.ul
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-8 grid gap-4 sm:grid-cols-2"
          >
            {LAUNCHPAD_SERVICES.map((service) => (
              <motion.li
                key={service.title}
                variants={item}
                className={cn(
                  "rounded-lg border px-5 py-4",
                  service.highlight
                    ? "border-amber-400/50 bg-amber-500/15"
                    : "border-amber-500/25 bg-black/20"
                )}
              >
                <h4 className="font-display font-semibold text-amber-100">
                  {service.title}
                  {service.highlight && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-amber-300/80">
                      Core
                    </span>
                  )}
                </h4>
                <p className="mt-2 text-sm text-amber-100/75 leading-relaxed">
                  {service.description}
                </p>
              </motion.li>
            ))}
          </motion.ul>

          <div className="mt-8 flex flex-col sm:flex-row gap-4 sm:items-center">
            <Link
              href="/#get-in-touch"
              className="inline-flex items-center justify-center rounded-lg bg-amber-500/90 px-6 py-3 font-display font-semibold text-amber-950 hover:bg-amber-400 transition-colors"
            >
              Start with Launchpad
            </Link>
            <p className="text-sm text-amber-200/70 font-mono">
              Graduate to full partnership when you hit qualification milestones.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
