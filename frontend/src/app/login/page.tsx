import AuthPage from "@/components/auth/AuthPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | SupervisorX AI Research",
  description: "Enter your credentials to access your research vault.",
};

export default function LoginPage() {
  return <AuthPage initialMode="login" />;
}
