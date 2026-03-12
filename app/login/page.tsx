"use client";

import { signIn } from "@/src/lib/auth-client";
import { useState } from "react";

const GitHubIcon = () => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className="w-4 h-4 fill-current"
  >
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleGithubLogin = async () => {
    setLoading(true);
    await signIn.social({
      provider: "github",
      callbackURL: "/dashboard",
    });
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative w-full max-w-sm">
        <div className="border border-[#1A1A2E] rounded-2xl p-8 bg-[#0D0D16] flex flex-col gap-6">

          {/* Logo */}
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-[#00FFA3]/10 border border-[#00FFA3]/20 flex items-center justify-center mb-1">
              <GitHubIcon />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              GitHub<span className="text-[#00FFA3]">Resolver</span>
            </h1>
            <p className="text-sm text-zinc-500">
              AI-powered GitHub error resolution
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-[#1A1A2E]" />

          {/* Feature list */}
          <div className="flex flex-col gap-2">
            {[
              "Detects PR errors and merge conflicts",
              "Auto-resolves bugs using Claude AI",
              "Opens a fix PR directly on your repo",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-[#00FFA3] shrink-0" />
                <span className="text-xs text-zinc-400">{item}</span>
              </div>
            ))}
          </div>

          {/* Button */}
          <button
            onClick={handleGithubLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 disabled:opacity-60 disabled:cursor-not-allowed text-black font-medium py-2.5 px-6 rounded-xl transition-colors text-sm"
          >
            <GitHubIcon />
            {loading ? "Redirecting to GitHub..." : "Continue with GitHub"}
          </button>

          {/* Footer */}
          <p className="text-center text-xs text-zinc-600">
            By continuing you allow GitHubResolver to access your repositories.
          </p>
        </div>
      </div>
    </main>
  );
}