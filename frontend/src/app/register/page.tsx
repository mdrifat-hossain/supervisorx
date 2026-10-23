import AuthPage from "@/components/auth/AuthPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register | SupervisorX AI Research",
  description: "Create your secure vault to begin orchestrating high-fidelity data models.",
};

export default function RegisterPage() {
  return <AuthPage initialMode="register" />;
}
