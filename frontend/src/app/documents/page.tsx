import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import GlobalDocumentsCenter from "@/components/documents/GlobalDocumentsCenter";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "All Documents | SupervisorX AI Research",
  description: "Unified repository of all research paper PDFs across your workspaces. Cross-import manuscripts without duplicate storage.",
};

export default async function DocumentsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  return <GlobalDocumentsCenter />;
}
