import Link from "next/link";

export function HomeFinalCta() {
  return (
    <section className="border-y border-border/50 bg-card/35 px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          Ready for a clearer path to more revenue?
        </h2>
        <p className="mt-4 text-foreground/70">Tell us where growth is getting stuck.</p>
        <Link
          href="/contact"
          className="mt-8 inline-flex items-center justify-center rounded-lg bg-accent px-7 py-3.5 font-semibold text-oled transition-colors hover:bg-cyan-300"
        >
          Start a conversation
        </Link>
      </div>
    </section>
  );
}
