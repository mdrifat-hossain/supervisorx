import ProjectsHub from "@/components/projects/ProjectsHub";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects | SupervisorX AI Research",
  description: "Explore, manage, and initialize academic research projects and workspaces in SupervisorX.",
};

export default function ProjectsPage() {
  return <ProjectsHub />;
}
