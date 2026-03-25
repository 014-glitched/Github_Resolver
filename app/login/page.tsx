"use client";

import { signIn } from "@/src/lib/auth-client";
import { useState } from "react";
import { ArrowRight, Bot, FolderGit2, ShieldCheck } from "lucide-react";

import { BrandMark, GitHubIcon } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
    <main className="relative min-h-screen overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="hero-surface absolute inset-0" />
      <div className="grid-surface grid-surface-lg absolute inset-0 opacity-30" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.05fr)_420px] lg:items-center">
          <section className="space-y-8">
            <BrandMark />
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/80">
                Production-ready repository ops
              </p>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Keep broken checks, merge blockers, and review requests in a single clear workflow.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Sign in with GitHub to connect repositories, monitor issues in real time, and trigger AI-assisted fixes without changing your team&apos;s core workflow.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: FolderGit2,
                  title: "Repository coverage",
                  body: "Connect public or private repos and manage them from one dashboard.",
                },
                {
                  icon: Bot,
                  title: "Resolution pipeline",
                  body: "Track queued, analyzing, patching, and PR creation states with clear feedback.",
                },
                {
                  icon: ShieldCheck,
                  title: "Review visibility",
                  body: "Keep fixes transparent with status badges, PR links, and guarded actions.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <Card key={title} className="bg-card/75">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-semibold">{title}</p>
                      <p className="text-sm leading-6 text-muted-foreground">{body}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <Card className="border-border/80 bg-card/92 shadow-md">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <div className="space-y-3 text-center">
                <div className="flex justify-center">
                  <div className="flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                    <GitHubIcon className="size-5" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight">Sign in to continue</h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Connect GitHub to start monitoring repositories and reviewing automated fixes.
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                {[
                  "Detects pull request failures and merge conflicts",
                  "Uses AI to prepare contextual fixes and PRs",
                  "Keeps actions, statuses, and next steps easy to scan",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="mt-1 size-2 rounded-full bg-primary" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleGithubLogin}
                disabled={loading}
                size="lg"
                className="w-full shadow-md"
              >
                <GitHubIcon className="size-4" />
                {loading ? "Redirecting to GitHub..." : "Continue with GitHub"}
                <ArrowRight className="size-4" />
              </Button>

              <p className="text-center text-xs leading-5 text-muted-foreground">
                By continuing, you allow GitHubResolver to access connected repositories according to your GitHub permissions.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
