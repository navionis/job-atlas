"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, ChevronDown } from "lucide-react";

export type Option = { value: string; label: string; hint?: string };

export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  compact,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  ariaLabel?: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const current = options.find((o) => o.value === value);
  return (
    <div className={"sel" + (compact ? " compact" : "")} ref={ref}>
      <button
        type="button"
        className="sel-btn"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="sel-value">{current?.label ?? value}</span>
        <ChevronDown size={13} className={"sel-chev" + (open ? " up" : "")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            className="sel-pop"
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
          >
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={"sel-opt" + (o.value === value ? " on" : "")}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <span>
                    {o.label}
                    {o.hint && <small>{o.hint}</small>}
                  </span>
                  {o.value === value && <Check size={13} />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
