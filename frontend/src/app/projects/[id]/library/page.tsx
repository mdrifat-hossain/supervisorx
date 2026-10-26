import { Suspense } from "react";
import ProjectPaperLibrary from "@/components/library/ProjectPaperLibrary";
import ProjectLoadingSkeleton from "@/components/common/ProjectLoadingSkeleton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "All Documents | SupervisorX AI Research",
  description: "Explore, search, sort, and access downloaded research papers and AI synthesis reports for your project in SupervisorX.",
};

export function generateStaticParams() {
  return [{ id: "cognitive-mapper" }, { id: "nlp-related-research-work-xxyjo" }];
}

export default async function ProjectPaperLibraryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id || "nlp-related-research-work-xxyjo";
  return (
    <Suspense fallback={<ProjectLoadingSkeleton projectId={projectId} />}>
      <ProjectPaperLibrary projectId={projectId} />
    </Suspense>
  );
}
