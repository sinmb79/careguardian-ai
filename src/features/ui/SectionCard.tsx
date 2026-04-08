import type { PropsWithChildren } from "react";

interface SectionCardProps extends PropsWithChildren {
  title: string;
  description: string;
}

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className="rounded-[28px] bg-white/90 p-6 shadow-card ring-1 ring-black/5">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-ink/70">{description}</p>
      </div>
      {children}
    </section>
  );
}
