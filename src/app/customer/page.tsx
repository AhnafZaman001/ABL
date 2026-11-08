import { Suspense } from "react";
import { CustomerApp } from "@/components/customer-app";

export default function CustomerPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted">Loading…</p>}>
      <CustomerApp />
    </Suspense>
  );
}
