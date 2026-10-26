import { Suspense } from "react";
import ProjectResearchChatbot from "@/components/chat/ProjectResearchChatbot";
import ProjectLoadingSkeleton from "@/components/common/ProjectLoadingSkeleton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find Papers AI Chatbot | SupervisorX AI Research",
  description: "SupervisorX Project-Specific Research Discovery & AI Chatbot",
};

export function generateStaticParams() {
  return [{ id: "cognitive-mapper" }];
}

export default async function DynamicProjectChatbotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id || "cognitive-mapper";
  return (
    <Suspense fallback={<ProjectLoadingSkeleton projectId={projectId} />}>
      <ProjectResearchChatbot projectId={projectId} />
    </Suspense>
  );
}
