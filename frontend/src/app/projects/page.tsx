import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ProjectsHub from "@/components/projects/ProjectsHub";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects | SupervisorX AI Research",
  description: "Explore, manage, and initialize academic research projects and workspaces in SupervisorX.",
};

export default async function ProjectsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  return <ProjectsHub />;
}
