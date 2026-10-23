import { Suspense } from "react";
import ProtectedDashboard, { DashboardLoading } from "@/components/auth/ProtectedDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Minimal Dashboard | SupervisorX AI Research",
  description: "SupervisorX research overview, continuity sticky notes, resource monitor, and project activity.",
};

export default function MinimalDashboardPage() {
  return <Suspense fallback={<DashboardLoading />}><ProtectedDashboard /></Suspense>;
}
