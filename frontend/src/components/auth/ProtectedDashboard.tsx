import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import MinimalDashboard from "@/components/dashboard/MinimalDashboard";

export function DashboardLoading() {
  return (
    <main className="min-h-screen bg-background text-on-background flex items-center justify-center">
      <p role="status">Loading your dashboard…</p>
    </main>
  );
}

export default async function ProtectedDashboard() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return <MinimalDashboard />;
}
