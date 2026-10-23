import PaperAnalyzeCenter from "@/components/analysis/PaperAnalyzeCenter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Upload & Analysis | Cognitive Mapper v4 | SupervisorX",
  description: "SupervisorX Research Paper Analysis Center with Active AI Engine and Batch Processing",
};

export default function CognitiveMapperAnalysisPage() {
  return <PaperAnalyzeCenter projectId="cognitive-mapper" />;
}
