import type { ReactNode } from "react";

/** A neutral phone container that stands in for the host banking app. */
export function PhoneFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-[360px] max-w-full rounded-[2.4rem] border border-line bg-ink p-2.5 shadow-xl">
        <div className="flex h-[700px] flex-col overflow-hidden rounded-[1.9rem] bg-canvas">
          <div className="flex items-center justify-between bg-brand px-5 pb-2 pt-3 text-[11px] text-white/80">
            <span>9:41</span>
            <span>Host banking app (simulated)</span>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
