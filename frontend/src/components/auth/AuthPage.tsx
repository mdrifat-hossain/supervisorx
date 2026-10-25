"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ShaderCanvas from "./ShaderCanvas";
import { authClient } from "@/lib/auth-client";

interface AuthPageProps {
  initialMode?: "login" | "register";
}

export default function AuthPage({ initialMode = "login" }: AuthPageProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">(initialMode);

  // Keep the animated form in sync with browser back/forward navigation.
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        if (window.location.pathname.includes("register")) {
          setMode("register");
        } else {
          setMode("login");
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loginStatus, setLoginStatus] = useState<"idle" | "validating" | "verified">("idle");
  const [loginError, setLoginError] = useState("");

  // Register form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regStatus, setRegStatus] = useState<"idle" | "initializing" | "created">("idle");
  const [registerError, setRegisterError] = useState("");

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loginStatus !== "idle") return;
    setLoginError("");
    setLoginStatus("validating");
    try {
      const result = loginEmail.includes("@")
        ? await authClient.signIn.email({ email: loginEmail, password: loginPassword })
        : await authClient.signIn.username({ username: loginEmail, password: loginPassword });
      if (result.error) {
        setLoginError(result.error.message || "Unable to sign in. Check your credentials and try again.");
        setLoginStatus("idle");
        return;
      }
      setLoginStatus("verified");
      router.push("/minimal-dashboard");
    } catch {
      setLoginError("Unable to reach the authentication server. Please try again.");
      setLoginStatus("idle");
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (regStatus !== "idle") return;
    setRegisterError("");
    if (regPassword !== regConfirm) {
      setRegisterError("Passwords do not match.");
      return;
    }
    setRegStatus("initializing");
    try {
      const result = await authClient.signUp.email({
        name: regName,
        email: regEmail,
        password: regPassword,
        username: regUsername,
      });
      if (result.error) {
        setRegisterError(result.error.message || "Unable to create your account. Please try again.");
        setRegStatus("idle");
        return;
      }
      setRegStatus("created");
      router.push("/minimal-dashboard");
    } catch {
      setRegisterError("Unable to reach the authentication server. Please try again.");
      setRegStatus("idle");
    }
  };

  const handleSocialSignIn = async (provider: "google" | "github") => {
    setLoginError("");
    setRegisterError("");
    try {
      const result = await authClient.signIn.social({ provider, callbackURL: "/minimal-dashboard" });
      if (result.error) {
        const message = result.error.message || `Unable to continue with ${provider}.`;
        setLoginError(message);
        setRegisterError(message);
      }
    } catch {
      const message = `Unable to reach the authentication server for ${provider}.`;
      setLoginError(message);
      setRegisterError(message);
    }
  };

  return (
    <div className="overflow-x-hidden min-h-screen w-full relative bg-background text-on-background font-body-md selection:bg-primary/30">
      {/* Sliding Main Container */}
      <main
        id="slider-container"
        className={`flex w-[200vw] min-h-screen transition-transform duration-500 ease-in-out transform ${
          mode === "register" ? "-translate-x-1/2" : "translate-x-0"
        }`}
      >
        {/* ================= LOGIN STATE ================= */}
        <div className="w-[100vw] flex flex-col md:flex-row min-h-screen shrink-0">
          {/* Left Section: Research Illustration */}
          <section className="hidden md:flex flex-1 relative bg-surface-container-lowest overflow-hidden items-center justify-center p-2xl">
            {/* WebGL Shader Background */}
            <ShaderCanvas variant="login" />

            <div className="relative z-10 w-full max-w-[580px] text-center space-y-lg px-4">
              <div className="inline-flex items-center px-md py-xs rounded-full bg-primary/10 border border-primary/20 text-primary font-label-md animate-pulse">
                <span className="material-symbols-outlined mr-2 text-[18px]">neurology</span>
                AI SUPERVISOR ACTIVE
              </div>
              <h1 className="font-display-lg text-display-lg text-on-surface tracking-tighter leading-none text-center">
                Unify Your <span className="text-primary">Research</span> Cognition.
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant w-full max-w-[460px] mx-auto text-center leading-relaxed">
                SupervisorX bridges the gap between raw data and breakthrough insights with high-fidelity neural processing.
              </p>

              {/* Abstract Research Illustration Element */}
              <div className="mt-2xl relative w-full max-w-[460px] mx-auto">
                <div className="absolute -inset-4 bg-primary/20 blur-3xl rounded-full"></div>
                <div className="glass-card p-xl rounded-xl border-outline-variant/30 animate-float">
                  <div className="space-y-md">
                    <div className="flex items-center gap-sm">
                      <div className="w-3 h-3 rounded-full bg-error"></div>
                      <div className="w-3 h-3 rounded-full bg-tertiary"></div>
                      <div className="w-3 h-3 rounded-full bg-primary"></div>
                    </div>
                    <div className="h-2 w-full bg-surface-variant rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-2/3 transition-all duration-1000"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-md pt-md">
                      <div className="h-16 rounded-lg bg-surface-bright/50 border border-outline-variant/20 flex flex-col items-center justify-center">
                        <span className="text-primary font-label-md text-label-md">98.4%</span>
                        <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">Precision</span>
                      </div>
                      <div className="h-16 rounded-lg bg-surface-bright/50 border border-outline-variant/20 flex flex-col items-center justify-center">
                        <span className="text-tertiary font-label-md text-label-md">1.2ms</span>
                        <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">Latency</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Absolute Decorative Nodes */}
            <div className="absolute top-10 left-10 opacity-20">
              <span className="material-symbols-outlined text-[120px] text-primary rotate-12">account_tree</span>
            </div>
            <div className="absolute bottom-10 right-10 opacity-20">
              <span className="material-symbols-outlined text-[100px] text-tertiary -rotate-12">monitoring</span>
            </div>
          </section>

          {/* Right Section: Login Form */}
          <section className="flex-1 flex flex-col justify-center items-center p-lg relative z-20">

            {/* Mobile Logo */}
            <Link href="/" className="md:hidden absolute top-xl right-lg flex items-center gap-sm group">
              <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shadow-sm shrink-0">
                <img
                  src="/synergy.png"
                  alt="SupervisorX Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-headline-md text-headline-md font-bold text-primary tracking-tight">SupervisorX</span>
            </Link>

            <div className="w-full max-w-[440px] space-y-xl">
              <div className="space-y-xs">
                <h2 className="font-headline-lg text-headline-lg text-on-surface">Welcome back</h2>
                <p className="text-on-surface-variant">Enter your credentials to access your research vault.</p>
              </div>

              {/* Glassmorphism Login Card */}
              <div className="glass-card p-xl rounded-2xl ink-shadow transition-all duration-300">
                <form className="space-y-lg" id="login-form" onSubmit={handleLoginSubmit}>
                  {/* Email Field */}
                  <div className="space-y-sm">
                    <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="email">
                      EMAIL OR USERNAME
                    </label>
                    <div className="relative group">
                      <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                        alternate_email
                      </span>
                      <input
                        className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl py-md pl-[48px] pr-md text-on-surface focus:border-primary focus:ring-0 transition-all placeholder:text-outline-variant outline-none"
                        id="email"
                        placeholder="name@institute.edu"
                        type="text"
                        autoComplete="username"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-sm">
                    <div className="flex justify-between items-center">
                      <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="password">
                        ACCESS KEY
                      </label>
                      <a className="font-label-md text-label-md text-primary hover:underline underline-offset-4" href="#forgot">
                        Forgot Password?
                      </a>
                    </div>
                    <div className="relative group">
                      <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                        lock
                      </span>
                      <input
                        className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl py-md pl-[48px] pr-md text-on-surface focus:border-primary focus:ring-0 transition-all placeholder:text-outline-variant outline-none"
                        id="password"
                        placeholder="••••••••"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                      <button
                        className="absolute right-md top-1/2 -translate-y-1/2 text-outline hover:text-on-surface cursor-pointer"
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {showPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {loginError && <p className="text-sm text-red-400" role="alert">{loginError}</p>}

                  {/* Options */}
                  <div className="flex items-center">
                    <input
                      className="w-4 h-4 rounded border-outline-variant bg-surface-container-low text-primary focus:ring-primary focus:ring-offset-background cursor-pointer"
                      id="remember"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <label className="ml-sm font-body-md text-on-surface-variant select-none cursor-pointer" htmlFor="remember">
                      Remember this device
                    </label>
                  </div>

                  {/* Main Login Button */}
                  <button
                    className={`w-full font-headline-md text-[18px] py-md rounded-xl active:scale-[0.98] transition-all duration-200 ink-shadow flex items-center justify-center gap-sm cursor-pointer ${
                      loginStatus === "verified"
                        ? "bg-green-500 text-white"
                        : "bg-primary text-on-primary hover:opacity-90"
                    }`}
                    type="submit"
                    disabled={loginStatus !== "idle"}
                  >
                    {loginStatus === "validating" ? (
                      <>
                        <span className="material-symbols-outlined animate-spin">sync</span>
                        Validating...
                      </>
                    ) : loginStatus === "verified" ? (
                      <>
                        <span className="material-symbols-outlined">check_circle</span>
                        Verified
                      </>
                    ) : (
                      <>
                        Login
                        <span className="material-symbols-outlined">arrow_forward</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-2xl">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-outline-variant/30"></div>
                  </div>
                  <div className="relative flex justify-center text-label-md uppercase tracking-widest">
                    <span className="bg-surface-container/80 backdrop-blur px-md text-outline">Social Auth</span>
                  </div>
                </div>

                {/* Social Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                  <button
                    type="button"
                    onClick={() => void handleSocialSignIn("google")}
                    className="flex items-center justify-center gap-sm bg-surface-container-high border border-outline-variant/40 hover:bg-surface-bright py-md rounded-xl transition-colors group cursor-pointer"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="currentColor"
                      ></path>
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="currentColor"
                      ></path>
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.27.81-.57z"
                        fill="currentColor"
                      ></path>
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="currentColor"
                      ></path>
                    </svg>
                    <span className="font-body-md text-on-surface group-hover:text-primary transition-colors">
                      Google
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSocialSignIn("github")}
                    className="flex items-center justify-center gap-sm bg-surface-container-high border border-outline-variant/40 hover:bg-surface-bright py-md rounded-xl transition-colors group cursor-pointer"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33c.85 0 1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z"
                        fill="currentColor"
                      ></path>
                    </svg>
                    <span className="font-body-md text-on-surface group-hover:text-primary transition-colors">
                      GitHub
                    </span>
                  </button>
                </div>
              </div>

              {/* Footer Text */}
              <div className="text-center pt-md">
                <p className="text-on-surface-variant font-body-md">
                  Don&apos;t have account?{" "}
                  <button
                    className="text-primary font-bold hover:underline underline-offset-4 ml-1 transition-all cursor-pointer"
                    id="btn-to-register"
                    type="button"
                    onClick={() => {
                      setMode("register");
                      if (typeof window !== "undefined") {
                        window.history.pushState(null, "", "/register");
                      }
                    }}
                  >
                    Register
                  </button>
                </p>
              </div>
            </div>

            {/* Footer Small */}
            <footer className="absolute bottom-xl text-center">
              <p className="text-outline text-label-md tracking-wider opacity-60">
                © 2024 SUPERVISORX AI RESEARCH LABS
              </p>
            </footer>
          </section>
        </div>

        {/* ================= REGISTER STATE ================= */}
        <div className="w-[100vw] flex flex-col md:flex-row min-h-screen shrink-0">
          {/* Left Section: Register Form */}
          <section className="flex-1 flex flex-col justify-center items-center p-lg relative z-20">

            {/* Mobile Logo */}
            <Link href="/" className="md:hidden absolute top-xl right-lg flex items-center gap-sm group">
              <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shadow-sm shrink-0">
                <img
                  src="/synergy.png"
                  alt="SupervisorX Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-headline-md text-headline-md font-bold text-primary tracking-tight">SupervisorX</span>
            </Link>
            <div className="w-full max-w-[440px] space-y-xl">
              <div className="space-y-xs">
                <h2 className="font-headline-lg text-headline-lg text-on-surface">Create an Account</h2>
                <p className="text-on-surface-variant">Setup your credentials to initialize your vault.</p>
              </div>

              {/* Glassmorphism Register Card */}
              <div className="glass-card p-xl rounded-2xl ink-shadow transition-all duration-300">
                <form className="space-y-lg" id="register-form" onSubmit={handleRegisterSubmit}>
                  <div className="grid grid-cols-1 gap-md">
                    {/* Full Name */}
                    <div className="space-y-sm">
                      <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="reg-name">
                        FULL NAME
                      </label>
                      <div className="relative group">
                        <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                          person
                        </span>
                        <input
                          className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl py-md pl-[48px] pr-md text-on-surface focus:border-primary focus:ring-0 transition-all placeholder:text-outline-variant outline-none"
                          id="reg-name"
                          placeholder="Dr. Jane Doe"
                          type="text"
                          autoComplete="name"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {/* Email & Username Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-[5.5fr_4.5fr] gap-md">
                      <div className="space-y-sm">
                        <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="reg-email">
                          EMAIL
                        </label>
                        <div className="relative group">
                          <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                            alternate_email
                          </span>
                          <input
                            className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl py-md pl-[48px] pr-md text-on-surface focus:border-primary focus:ring-0 transition-all placeholder:text-outline-variant outline-none"
                            id="reg-email"
                            placeholder="jane@institute.edu"
                            type="email"
                            autoComplete="email"
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-sm">
                        <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="reg-username">
                          USERNAME
                        </label>
                        <div className="relative group">
                          <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                            badge
                          </span>
                          <input
                            className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl py-md pl-[48px] pr-md text-on-surface focus:border-primary focus:ring-0 transition-all placeholder:text-outline-variant outline-none"
                            id="reg-username"
                            placeholder="jdoe_res"
                            type="text"
                            autoComplete="username"
                            value={regUsername}
                            onChange={(e) => setRegUsername(e.target.value)}
                            required
                          />
                          <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 text-green-500 text-[18px]">
                            check_circle
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Passwords */}
                    <div className="grid grid-cols-1 sm:grid-cols-[5.5fr_4.5fr] gap-md">
                      <div className="space-y-sm">
                        <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="reg-password">
                          PASSWORD
                        </label>
                        <div className="relative group">
                          <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                            lock
                          </span>
                          <input
                            className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl py-md pl-[48px] pr-md text-on-surface focus:border-primary focus:ring-0 transition-all placeholder:text-outline-variant outline-none"
                            id="reg-password"
                            placeholder="••••••••"
                            type={showRegPassword ? "text" : "password"}
                            autoComplete="new-password"
                            minLength={8}
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            required
                          />
                          <button
                            className="absolute right-md top-1/2 -translate-y-1/2 text-outline hover:text-on-surface cursor-pointer"
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            aria-label={showRegPassword ? "Hide password" : "Show password"}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {showRegPassword ? "visibility_off" : "visibility"}
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-sm">
                        <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="reg-confirm">
                          CONFIRM
                        </label>
                        <div className="relative group">
                          <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
                            lock_reset
                          </span>
                          <input
                            className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl py-md pl-[48px] pr-md text-on-surface focus:border-primary focus:ring-0 transition-all placeholder:text-outline-variant outline-none"
                            id="reg-confirm"
                            placeholder="••••••••"
                            type={showRegConfirm ? "text" : "password"}
                            autoComplete="new-password"
                            minLength={8}
                            value={regConfirm}
                            onChange={(e) => setRegConfirm(e.target.value)}
                            required
                          />
                          <button
                            className="absolute right-md top-1/2 -translate-y-1/2 text-outline hover:text-on-surface cursor-pointer"
                            type="button"
                            onClick={() => setShowRegConfirm(!showRegConfirm)}
                            aria-label={showRegConfirm ? "Hide password" : "Show password"}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {showRegConfirm ? "visibility_off" : "visibility"}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {registerError && <p className="text-sm text-red-400" role="alert">{registerError}</p>}

                  {/* Main Register Button */}
                  <button
                    className={`w-full font-headline-md text-[18px] py-md rounded-xl active:scale-[0.98] transition-all duration-200 ink-shadow flex items-center justify-center gap-sm mt-md cursor-pointer ${
                      regStatus === "created"
                        ? "bg-green-500 text-white"
                        : "bg-primary text-on-primary hover:opacity-90"
                    }`}
                    type="submit"
                    disabled={regStatus !== "idle"}
                  >
                    {regStatus === "initializing" ? (
                      <>
                        <span className="material-symbols-outlined animate-spin">sync</span>
                        Initializing...
                      </>
                    ) : regStatus === "created" ? (
                      <>
                        <span className="material-symbols-outlined">check_circle</span>
                        Vault Created
                      </>
                    ) : (
                      <>
                        Initialize Vault
                        <span className="material-symbols-outlined">add_moderator</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-lg">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-outline-variant/30"></div>
                  </div>
                  <div className="relative flex justify-center text-label-md uppercase tracking-widest">
                    <span className="bg-surface-container/80 backdrop-blur px-md text-outline">Social Auth</span>
                  </div>
                </div>

                {/* Social Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                  <button
                    type="button"
                    onClick={() => void handleSocialSignIn("google")}
                    className="flex items-center justify-center gap-sm bg-surface-container-high border border-outline-variant/40 hover:bg-surface-bright py-md rounded-xl transition-colors group cursor-pointer"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="currentColor"
                      ></path>
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="currentColor"
                      ></path>
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.27.81-.57z"
                        fill="currentColor"
                      ></path>
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="currentColor"
                      ></path>
                    </svg>
                    <span className="font-body-md text-on-surface group-hover:text-primary transition-colors">
                      Google
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSocialSignIn("github")}
                    className="flex items-center justify-center gap-sm bg-surface-container-high border border-outline-variant/40 hover:bg-surface-bright py-md rounded-xl transition-colors group cursor-pointer"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33c.85 0 1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z"
                        fill="currentColor"
                      ></path>
                    </svg>
                    <span className="font-body-md text-on-surface group-hover:text-primary transition-colors">
                      GitHub
                    </span>
                  </button>
                </div>
              </div>

              {/* Footer Text */}
              <div className="text-center pt-md">
                <p className="text-on-surface-variant font-body-md">
                  Already have an account?{" "}
                  <button
                    className="text-primary font-bold hover:underline underline-offset-4 ml-1 transition-all cursor-pointer"
                    id="btn-to-login"
                    type="button"
                    onClick={() => {
                      setMode("login");
                      if (typeof window !== "undefined") {
                        window.history.pushState(null, "", "/login");
                      }
                    }}
                  >
                    Login
                  </button>
                </p>
              </div>
            </div>
          </section>

          {/* Right Section: Register Illustration */}
          <section className="hidden md:flex flex-1 relative bg-surface-container-lowest overflow-hidden items-center justify-center p-2xl">
            {/* WebGL Shader Background */}
            <ShaderCanvas variant="register" />

            <div className="relative z-10 w-full max-w-[580px] text-center space-y-lg px-4">
              <h1 className="font-display-lg text-display-lg text-on-surface tracking-tighter leading-none text-center">
                Join the Future of <br />
                <span className="text-primary">AI Synthesis</span>.
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant w-full max-w-[460px] mx-auto text-center leading-relaxed">
                Welcome to SupervisorX Research Labs. Create your secure vault to begin orchestrating high-fidelity data models.
              </p>

              <div className="grid grid-cols-1 gap-md pt-xl w-full max-w-[460px] mx-auto">
                <div className="flex items-center gap-md p-md rounded-xl bg-surface-container/40 border border-outline-variant/20 backdrop-blur-sm">
                  <span className="material-symbols-outlined text-primary">hub</span>
                  <div className="text-left">
                    <p className="font-bold text-on-surface">Real-time AI Synthesis</p>
                    <p className="text-label-md text-on-surface-variant">Instant neural processing of raw datasets.</p>
                  </div>
                </div>

                <div className="flex items-center gap-md p-md rounded-xl bg-surface-container/40 border border-outline-variant/20 backdrop-blur-sm">
                  <span className="material-symbols-outlined text-tertiary">language</span>
                  <div className="text-left">
                    <p className="font-bold text-on-surface">Global Knowledge Graph</p>
                    <p className="text-label-md text-on-surface-variant">Connect insights across distributed networks.</p>
                  </div>
                </div>

                <div className="flex items-center gap-md p-md rounded-xl bg-surface-container/40 border border-outline-variant/20 backdrop-blur-sm">
                  <span className="material-symbols-outlined text-primary">auto_settings</span>
                  <div className="text-left">
                    <p className="font-bold text-on-surface">Autonomous Pipeline Optimization</p>
                    <p className="text-label-md text-on-surface-variant">Self-healing research workflows.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10">
        <div className="absolute top-[10%] right-[5%] w-[400px] h-[400px] bg-primary/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[10%] left-[5%] w-[300px] h-[300px] bg-tertiary/5 blur-[100px] rounded-full"></div>
      </div>
    </div>
  );
}
