import { Suspense } from "react";
import ProjectResearchChatbot from "@/components/chat/ProjectResearchChatbot";
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
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ProjectResearchChatbot projectId={resolvedParams.id || "cognitive-mapper"} />
    </Suspense>
  );
}
