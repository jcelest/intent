import { Header } from "@/components/sections/header";
import { Footer } from "@/components/sections/footer";

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10 min-h-screen">
      <Header />
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-3xl">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-3 text-sm text-muted font-mono">
            Last updated {updated}
          </p>
          <div className="mt-10 space-y-10 text-[15px] leading-relaxed text-foreground/85 sm:text-base">
            {children}
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
