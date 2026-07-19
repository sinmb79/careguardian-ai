import type { PropsWithChildren } from "react";

interface SectionCardProps extends PropsWithChildren {
  title: string;
  description: string;
  icon?: string;
  step?: number;
  totalSteps?: number;
}

export function SectionCard({ title, description, icon, step, totalSteps, children }: SectionCardProps) {
  return (
    <section className="rounded-[28px] bg-white/90 p-6 shadow-card ring-1 ring-black/5">
      <div className="mb-5">
        {step !== undefined && totalSteps !== undefined && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-bold text-sage">{step} / {totalSteps}</span>
            <div className="h-2 flex-1 rounded-full bg-ink/5">
              <div
                className="h-2 rounded-full bg-sage transition-all"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}
        <h2 className="text-2xl font-semibold text-ink">
          {icon && <span className="mr-2">{icon}</span>}
          {title}
        </h2>
        <p className="mt-2 text-base leading-7 text-ink/70">{description}</p>
      </div>
      {children}
    </section>
  );
}
