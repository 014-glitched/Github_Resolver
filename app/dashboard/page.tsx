import { redirect } from "next/navigation";

// ISSUES-ONLY MODE: commit/CI/PR-conflict event feed temporarily disabled.
// Previous dashboard UI preserved at app/dashboard/_event-feed-page.disabled.tsx
export default function DashboardPage() {
  redirect("/dashboard/issues");
}
