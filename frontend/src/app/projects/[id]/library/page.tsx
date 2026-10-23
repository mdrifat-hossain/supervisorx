import { Suspense } from "react";
import ProjectPaperLibrary from "@/components/library/ProjectPaperLibrary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paper Library | SupervisorX AI Research",
  description: "Explore, search, sort, and access downloaded research papers for your project in SupervisorX.",
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
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ProjectPaperLibrary projectId={resolvedParams.id || "nlp-related-research-work-xxyjo"} />
    </Suspense>
  );
}
