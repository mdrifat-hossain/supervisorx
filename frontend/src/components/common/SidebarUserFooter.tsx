"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    const userPart = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
    if (userPart.length >= 2) {
      return userPart.slice(0, 2).toUpperCase();
    }
    if (userPart.length === 1) {
      return (userPart + "X").toUpperCase();
    }
  }
  return "SX";
}

export default function SidebarUserFooter() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "Researcher";
  const displayEmail = session?.user?.email || "Signed In";
  const userImage = session?.user?.image;
  const initials = getInitials(session?.user?.name, session?.user?.email);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await authClient.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
    }
  };

  return (
    <div className="pt-3 border-t border-outline-variant/20 mt-auto">
      <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/30 hover:border-outline-variant/50 transition-all gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* User Profile Logo / Image (2-letter initials fallback) */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-container to-tertiary-container overflow-hidden border border-primary/30 flex items-center justify-center font-label-md font-semibold text-primary text-xs shrink-0 shadow-sm select-none">
            {userImage ? (
              <img
                src={userImage}
                alt={displayName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          {/* User Account Name & Email */}
          <div className="truncate flex-1 min-w-0">
            <div
              className="font-headline-md font-semibold text-on-surface leading-tight truncate text-xs"
              title={displayName}
            >
              {displayName}
            </div>
            <div
              className="font-code-sm text-[10px] text-on-surface-variant truncate"
              title={displayEmail}
            >
              {displayEmail}
            </div>
          </div>
        </div>

        {/* Functional Logout Icon Button */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          title="Log out of account"
          className="text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50 flex items-center justify-center"
        >
          <span
            className={`material-symbols-outlined text-[18px] ${
              isLoggingOut ? "animate-spin" : ""
            }`}
          >
            {isLoggingOut ? "progress_activity" : "logout"}
          </span>
        </button>
      </div>
    </div>
  );
}
