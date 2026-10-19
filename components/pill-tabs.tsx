"use client";
import type { ReactNode } from "react";

export type PillTabOption = { value: string; label: ReactNode; icon?: ReactNode };

/** Shared pill-style tab group (`.m-tab` styling). `cls` customizes the wrapper. */
export function PillTabs({
  value,
  onChange,
  options,
  ariaLabel,
  cls = "m-tabs",
}: {
  value: string;
  onChange: (v: string) => void;
  options: PillTabOption[];
  ariaLabel: string;
  cls?: string;
}) {
  return (
    <div className={cls} role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={"m-tab" + (o.value === value ? " on" : "")}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
