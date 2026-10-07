import Link from "next/link";
import { CheckCircle2, GitPullRequest, LoaderCircle, Sparkles } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { GithubSignInButton } from "@/components/github-sign-in-button";
import { Button } from "@/components/ui/button";

const pipeline = [
  {
    label: "Queued",
    detail: "Issue #42 · auth timeout on login",
    icon: LoaderCircle,
    tone: "text-muted-foreground",
    iconClass: "text-muted-foreground",
  },
  {
    label: "Analyzing",
    detail: "Claude reviewing repo context…",
    icon: Sparkles,
    tone: "text-primary",
    iconClass: "text-primary",
  },
  {
    label: "PR ready",
    detail: "fix/auto-issue-42 opened for review",
    icon: GitPullRequest,
    tone: "text-success",
    iconClass: "text-success",
  },
] as const;

export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div className="hero-surface absolute inset-0" />
      <div className="grid-surface absolute inset-0 opacity-25" />
      <div className="auth-orb -left-20 top-0 h-80 w-80 bg-primary/25" />
      <div
        className="auth-orb -right-10 bottom-0 h-72 w-72 bg-info/15"
        style={{ animationDelay: "2s" }}
      />

      <div className="relative flex h-full w-full flex-col px-6 py-5 sm:px-8 lg:px-14">
        <header className="auth-fade-up flex shrink-0 items-center justify-between">
          <BrandMark />
          <GithubSignInButton
            label="Sign in"
            variant="ghost"
            size="default"
            showIcon={false}
            showArrow={false}
            className="rounded-full border border-white/15 bg-white/10 px-4 text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-white/15 hover:text-foreground"
          />
        </header>

        <section className="flex min-h-0 flex-1 flex-col justify-center py-4 lg:py-6">
          <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
            <div className="auth-fade-up-delay space-y-7">
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/85 sm:text-sm">
                  GitHubResolver
                </p>
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[3.4rem] lg:leading-[1.08]">
                  Turn broken issues into review-ready pull requests.
                </h1>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                  Connect a repo, pick an issue, and let Claude draft a fix PR—without leaving your ops flow.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <GithubSignInButton className="shadow-lg shadow-primary/25" />
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/15 bg-white/5 backdrop-blur-sm hover:bg-white/10"
                >
                  <Link href="/login">View dashboard</Link>
                </Button>
              </div>
            </div>

            <div className="auth-fade-up-delay-2 glass-panel relative rounded-2xl p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Resolve pipeline
                  </p>
                  <p className="mt-1 text-sm text-foreground/90">Live job preview</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                  <CheckCircle2 className="size-3.5" />
                  Healthy
                </span>
              </div>

              <div className="space-y-3">
                {pipeline.map(({ label, detail, icon: Icon, tone, iconClass }, index) => (
                  <div
                    key={label}
                    className="relative flex gap-3 rounded-xl border border-white/10 bg-background/35 p-3.5 backdrop-blur-sm"
                  >
                    {index < pipeline.length - 1 ? (
                      <span className="absolute left-[1.55rem] top-[2.85rem] h-[calc(100%-0.35rem)] w-px bg-white/10" />
                    ) : null}
                    <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                      <Icon className={`size-4 ${iconClass}`} />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className={`text-sm font-medium ${tone}`}>{label}</p>
                      <p className="truncate text-sm text-muted-foreground">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3">
                <p className="text-sm font-medium text-foreground">PR #128 ready for review</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Diff includes session refresh fix · awaiting your approval
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
