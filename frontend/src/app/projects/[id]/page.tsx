import { Suspense } from "react";
import CognitiveMapperDashboard from "@/components/projects/CognitiveMapperDashboard";
import ProjectLoadingSkeleton from "@/components/common/ProjectLoadingSkeleton";
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
  const projectId = resolvedParams.id || "cognitive-mapper";
  return (
    <Suspense fallback={<ProjectLoadingSkeleton projectId={projectId} />}>
      <CognitiveMapperDashboard projectId={projectId} />
    </Suspense>
  );
}
