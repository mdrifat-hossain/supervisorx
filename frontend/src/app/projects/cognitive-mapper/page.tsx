import CognitiveMapperDashboard from "@/components/projects/CognitiveMapperDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cognitive Mapper v4 Dashboard | SupervisorX AI Research",
  description: "Exploration of latent space dynamics and multi-head attention entropy in high-dimensional transformer representations.",
};

export default function CognitiveMapperPage() {
  return <CognitiveMapperDashboard />;
}
