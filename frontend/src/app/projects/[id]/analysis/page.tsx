import { Suspense } from "react";
import PaperAnalyzeCenter from "@/components/analysis/PaperAnalyzeCenter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Upload & Analysis | SupervisorX AI Research",
  description: "SupervisorX Research Paper Analysis Center with Active AI Engine and Batch Processing",
};

export function generateStaticParams() {
  return [{ id: "cognitive-mapper" }];
}

export default async function DynamicProjectAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <PaperAnalyzeCenter projectId={resolvedParams.id || "cognitive-mapper"} />
    </Suspense>
  );
}
