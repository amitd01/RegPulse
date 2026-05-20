import type { ReactNode } from "react";

/**
 * Simple section heading used within page content areas.
 * Matches the `.page-header` style from the design: DM Serif Display h2 + subtitle.
 * Does NOT use a coloured background — the cream page bg shows through.
 */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-[26px] leading-tight text-[#1A2B40] dark:text-gray-100">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-[13.5px] text-[#4D6480] dark:text-gray-400">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
