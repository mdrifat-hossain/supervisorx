import { Suspense } from "react";
import CognitiveMapperDashboard from "@/components/projects/CognitiveMapperDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Project Dashboard | SupervisorX AI Research",
  description: "SupervisorX project workspace, pipeline execution, persistent notes, and research telemetry.",
};

export function generateStaticParams() {
  return [{ id: "cognitive-mapper" }];
}

export default async function DynamicProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <CognitiveMapperDashboard projectId={resolvedParams.id || "cognitive-mapper"} />
    </Suspense>
  );
}
