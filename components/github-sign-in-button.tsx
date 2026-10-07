"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { GitHubIcon } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { signIn } from "@/src/lib/auth-client";
import { cn } from "@/lib/utils";

type GithubSignInButtonProps = {
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive" | "link";
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
  className?: string;
  showIcon?: boolean;
  showArrow?: boolean;
  callbackURL?: string;
};

export function GithubSignInButton({
  label = "Continue with GitHub",
  variant = "default",
  size = "lg",
  className,
  showIcon = true,
  showArrow = true,
  callbackURL = "/dashboard",
}: GithubSignInButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleGithubLogin = async () => {
    setLoading(true);
    try {
      await signIn.social({
        provider: "github",
        callbackURL,
      });
    } catch {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleGithubLogin}
      disabled={loading}
      variant={variant}
      size={size}
      className={cn(className)}
    >
      {showIcon ? <GitHubIcon className="size-4" /> : null}
      {loading ? "Redirecting to GitHub..." : label}
      {showArrow && !loading ? <ArrowRight className="size-4" /> : null}
    </Button>
  );
}
