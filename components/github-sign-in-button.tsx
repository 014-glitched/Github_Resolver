"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

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
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGithubLogin = async () => {
    if (!mounted || loading) return;

    setLoading(true);
    try {
      const result = await signIn.social({
        provider: "github",
        callbackURL,
      });

      if (result?.error) {
        const message =
          result.error.message ||
          result.error.statusText ||
          "GitHub sign-in failed. Please try again.";
        toast.error(message);
        setLoading(false);
      }
      // On success better-auth redirects via window.location; keep loading true.
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "GitHub sign-in failed. Please try again.";
      toast.error(message);
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleGithubLogin}
      disabled={!mounted || loading}
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
