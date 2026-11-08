import type { ReactNode } from "react";
import type { PayeeStatus, ReportStatus, RiskLevel, TransferStatus } from "@/lib/types";

export function Card({ title, action, children, className = "" }: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-surface ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

type Tone = "neutral" | "brand" | "allow" | "pause" | "hold" | "stop";

const TONES: Record<Tone, string> = {
  neutral: "bg-canvas text-muted border-line",
  brand: "bg-brand-soft text-brand-strong border-transparent",
  allow: "bg-allow-soft text-allow border-transparent",
  pause: "bg-pause-soft text-pause border-transparent",
  hold: "bg-hold-soft text-hold border-transparent",
  stop: "bg-stop-soft text-stop border-transparent",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const PAYEE_STATUS: Record<PayeeStatus, [Tone, string]> = {
  active: ["neutral", "No reports"],
  under_review: ["hold", "Under review"],
  confirmed_mule: ["stop", "Confirmed mule"],
};

export function PayeeStatusBadge({ status }: { status: PayeeStatus }) {
  const [tone, label] = PAYEE_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const TRANSFER_STATUS: Record<TransferStatus, [Tone, string]> = {
  completed: ["allow", "Sent"],
  pending_approval: ["hold", "Awaiting approval"],
  cooling_off: ["pause", "Cooling off"],
  stopped: ["stop", "Stopped"],
  cancelled: ["neutral", "Cancelled"],
  declined: ["stop", "Declined by contact"],
};

export function TransferStatusBadge({ status }: { status: TransferStatus }) {
  const [tone, label] = TRANSFER_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const REPORT_STATUS: Record<ReportStatus, [Tone, string]> = {
  new: ["hold", "New"],
  investigating: ["pause", "Investigating"],
  confirmed: ["stop", "Confirmed scam"],
  rejected: ["neutral", "Not a scam"],
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const [tone, label] = REPORT_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export const RISK_LEVEL_TONE: Record<RiskLevel, Tone> = {
  allow: "allow",
  pause: "pause",
  hold: "hold",
  stop: "stop",
};

export function SimulatedNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-pause/40 bg-pause-soft px-3 py-2 text-xs text-pause">
      <span className="font-semibold">Simulated: </span>
      {children}
    </p>
  );
}

export function Button({ variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-strong",
    secondary: "border border-line bg-surface text-ink hover:bg-canvas",
    danger: "bg-stop text-white hover:opacity-90",
    ghost: "text-muted hover:bg-canvas hover:text-ink",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    />
  );
}
