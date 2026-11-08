import type { RiskReason } from "@/lib/types";

export type Lang = "en" | "ur";

export function ReasonList({ reasons, lang }: { reasons: RiskReason[]; lang: Lang }) {
  if (reasons.length === 0) return null;
  return (
    <ul className="space-y-2">
      {reasons.map((r) => (
        <li
          key={r.code}
          className={`flex gap-2 rounded-lg bg-surface px-3 py-2 text-sm ${lang === "ur" ? "urdu flex-row-reverse text-right" : ""}`}
        >
          <span aria-hidden="true" className="mt-0.5 shrink-0 text-hold">●</span>
          <span>{lang === "ur" ? r.ur : r.en}</span>
        </li>
      ))}
    </ul>
  );
}

export function LangToggle({ lang, onChange }: { lang: Lang; onChange: (lang: Lang) => void }) {
  return (
    <div className="inline-flex rounded-full border border-line bg-surface p-0.5 text-xs">
      {(["en", "ur"] as const).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`rounded-full px-2.5 py-0.5 ${lang === l ? "bg-brand text-white" : "text-muted"}`}
          aria-pressed={lang === l}
        >
          {l === "en" ? "English" : "اردو"}
        </button>
      ))}
    </div>
  );
}

/** Pick the English or Urdu string, applying Urdu typography when needed. */
export function T({ lang, en, ur, className = "" }: { lang: Lang; en: string; ur: string; className?: string }) {
  return <span className={`block ${lang === "ur" ? "urdu" : ""} ${className}`}>{lang === "ur" ? ur : en}</span>;
}
