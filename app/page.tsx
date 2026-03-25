import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, Workflow } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="hero-surface absolute inset-0" />
      <div className="grid-surface absolute inset-0 opacity-30" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <BrandMark compact />
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary/80">
                  Modern GitHub Ops
                </p>
                <div className="space-y-4">
                  <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                    Resolve flaky CI, merge conflicts, and code regressions from one calm dashboard.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                    GitHubResolver watches your repositories, surfaces failures with context, and helps turn broken flows into review-ready pull requests.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="shadow-md">
                  <Link href="/login">
                    Continue with GitHub
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/dashboard">View dashboard</Link>
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    icon: Workflow,
                    title: "Continuous monitoring",
                    body: "Track repository health and issue flow in one place.",
                  },
                  {
                    icon: Sparkles,
                    title: "AI-assisted remediation",
                    body: "Kick off fixes without leaving your operational view.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Review-friendly output",
                    body: "Keep action states, PRs, and ownership visible to the team.",
                  },
                ].map(({ icon: Icon, title, body }) => (
                  <Card key={title} className="bg-card/80">
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
            </div>

            <Card className="border-border/80 bg-card/90 shadow-md">
              <CardContent className="space-y-6 p-6 sm:p-8">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Operational snapshot
                  </p>
                  <div className="space-y-3">
                    {[
                      { label: "Issues detected", value: "18", tone: "text-destructive" },
                      { label: "Auto-resolved today", value: "11", tone: "text-success" },
                      { label: "PRs ready for review", value: "7", tone: "text-info" },
                    ].map((metric) => (
                      <div
                        key={metric.label}
                        className="flex items-center justify-between rounded-lg border border-border/70 bg-background/80 px-4 py-3"
                      >
                        <span className="text-sm text-muted-foreground">{metric.label}</span>
                        <span className={`text-lg font-semibold ${metric.tone}`}>{metric.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/10 p-5">
                  <p className="text-sm font-semibold text-foreground">Built for focused engineering teams</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Stripe, Vercel, and Linear-inspired clarity with an app frame designed for fast scanning, clean actions, and predictable states.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
