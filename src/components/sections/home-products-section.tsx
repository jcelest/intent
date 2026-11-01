import Link from "next/link";

const PRODUCTS = [
  {
    name: "LeadNet",
    headline: "Turn interest into conversations.",
    description:
      "Capture demand, respond faster, and give every new lead a clear next step.",
    points: ["Lead capture", "Fast follow-up", "Clear intake and reporting"],
    href: "/leadnet",
    cta: "Explore LeadNet",
  },
  {
    name: "Intent Quoting System",
    headline: "Turn pricing into a growth tool.",
    description:
      "Give customers useful quotes in minutes while your team keeps control of the final price.",
    points: ["Built from your price book", "Customer and team quoting", "Human review before approval"],
    href: "/intent-quoting-system",
    cta: "Explore Quoting",
  },
];

export function HomeProductsSection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24" aria-labelledby="products-heading">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">What we build</p>
          <h2 id="products-heading" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            Two products. One job: help you win more revenue.
          </h2>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {PRODUCTS.map((product) => (
            <article key={product.name} className="flex flex-col rounded-2xl border border-white/10 bg-card/45 p-7 sm:p-9">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">{product.name}</p>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{product.headline}</h3>
              <p className="mt-4 max-w-xl leading-7 text-foreground/70">{product.description}</p>
              <ul className="mt-6 grid gap-3 text-sm text-foreground/75 sm:grid-cols-3">
                {product.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <Link href={product.href} className="mt-8 inline-flex w-fit items-center font-semibold text-accent hover:text-cyan-300">
                {product.cta} <span aria-hidden className="ml-2">→</span>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
