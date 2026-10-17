"use client";
import { countries, groups } from "../lib/geo";
import { catalog } from "../lib/catalog";
import { Select } from "./select";
import { Spinner } from "./loader";
import type { DiscoverFilters } from "../lib/types";

export function FiltersPanel({
  value,
  onChange,
  onReset,
  busy = false,
}: {
  value: DiscoverFilters;
  onChange: (patch: Partial<DiscoverFilters>) => void;
  onReset: () => void;
  busy?: boolean;
}) {
  const { country, group, mode, source, sched, remote, remoteTo, unknown } = value;
  const countryOptions = countries.filter((c) => !group || groups[group]?.includes(c.code));
  const homeName = countries.find((c) => c.code === remoteTo)?.name || "";
  return (
    <>
      <div className="filter-title">
        Find your place{" "}
        <button onClick={onReset} disabled={busy}>
          {busy ? <Spinner size={12} /> : "Reset"}
        </button>
      </div>
      <label>
        REGION OR GROUP
        <Select
          ariaLabel="Region or group"
          disabled={busy}
          value={group}
          onChange={(v) => onChange({ group: v, country: "" })}
          options={[
            { value: "", label: "All regions" },
            ...Object.keys(groups)
              .sort()
              .map((g) => ({ value: g, label: g })),
          ]}
        />
      </label>
      <label>
        EXCLUDE COUNTRY
        <Select
          ariaLabel="Country or territory"
          disabled={busy}
          value={country}
          onChange={(v) => onChange({ country: v })}
          options={[
            { value: "", label: "No exclusion" },
            ...(country && !countryOptions.some((c) => c.code === country)
              ? [
                  {
                    value: country,
                    label: `${countries.find((c) => c.code === country)?.name} (selected)`,
                  },
                ]
              : []),
            ...countryOptions.map((c) => ({ value: c.code, label: `${c.name} · ${c.code}` })),
          ]}
        />
      </label>
      <label>
        MATCH AGAINST
        <Select
          ariaLabel="Match against"
          disabled={busy}
          value={mode}
          onChange={(v) => onChange({ mode: v })}
          options={[
            { value: "location", label: "Listed location" },
            { value: "eligibility", label: "Candidate eligibility" },
          ]}
        />
      </label>
      <label>
        SOURCE
        <Select
          ariaLabel="Source"
          disabled={busy}
          value={source}
          onChange={(v) => onChange({ source: v })}
          options={[
            { value: "", label: "All connected sources" },
            ...catalog.filter((c) => c.implemented).map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </label>
      <label>
        FULL / PART TIME
        <Select
          ariaLabel="Schedule"
          disabled={busy}
          value={sched}
          onChange={(v) => onChange({ sched: v })}
          options={[
            { value: "", label: "Any schedule" },
            { value: "full", label: "Full-time" },
            { value: "part", label: "Part-time" },
          ]}
        />
      </label>
      <label>
        WORK MODE
        <Select
          ariaLabel="Work mode"
          disabled={busy}
          value={remote}
          onChange={(v) => onChange({ remote: v })}
          options={[
            { value: "", label: "All locations" },
            { value: "remote", label: "Remote only" },
            { value: "onsite", label: "On-site / office" },
          ]}
        />
      </label>
      <label>
        REMOTE TO
        <Select
          ariaLabel="Remote to country"
          disabled={busy}
          value={remoteTo}
          onChange={(v) => onChange({ remoteTo: v })}
          options={[
            { value: "", label: "Anywhere" },
            ...countries.map((c) => ({ value: c.code, label: `${c.name} · ${c.code}` })),
          ]}
        />
      </label>
      {remoteTo && (
        <div className="note">
          <b>Remote to {homeName}</b>
          <p>
            Showing remote listings whose candidate scope includes {homeName}, and hiding listings physically located in{" "}
            {homeName}.
          </p>
        </div>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={unknown}
          disabled={busy}
          onChange={(e) => onChange({ unknown: e.target.checked })}
        />
        Include unknown / needs review
      </label>
      <div className="note">
        <b>Remote ≠ worldwide</b>
        <p>
          A country match is a discovery aid, not proof of work authorization. Confirm the employer’s requirements
          before applying.
        </p>
      </div>
    </>
  );
}
