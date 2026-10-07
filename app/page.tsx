import { BrandMark } from "@/components/brand-mark";
import { GithubSignInButton } from "@/components/github-sign-in-button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div className="hero-surface absolute inset-0" />
      <div className="grid-surface absolute inset-0 opacity-30" />

      <div className="relative flex h-full w-full flex-col px-6 py-5 sm:px-8 lg:px-12">
        <header className="flex shrink-0 items-center justify-between">
          <BrandMark compact />
          <GithubSignInButton
            label="Sign in"
            variant="ghost"
            size="default"
            showIcon={false}
            showArrow={false}
          />
        </header>

        <section className="flex min-h-0 flex-1 flex-col justify-center py-4 lg:py-6">
          <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-12">
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary/80">
                  Modern GitHub Ops
                </p>
                <div className="space-y-3">
                  <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                    Resolve flaky CI, merge conflicts, and code regressions from one calm dashboard.
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                    GitHubResolver watches your repositories, surfaces failures with context, and helps turn broken flows into review-ready pull requests.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <GithubSignInButton className="shadow-md" />
                <GithubSignInButton
                  label="View dashboard"
                  variant="outline"
                  showIcon={false}
                  showArrow={false}
                />
              </div>
            </div>

            <Card className="border-border/80 bg-card/90 shadow-md">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Operational snapshot
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { label: "Issues detected", value: "18", tone: "text-destructive" },
                      { label: "Auto-resolved today", value: "11", tone: "text-success" },
                      { label: "PRs ready for review", value: "7", tone: "text-info" },
                    ].map((metric) => (
                      <div
                        key={metric.label}
                        className="flex items-center justify-between rounded-lg border border-border/70 bg-background/80 px-4 py-2.5"
                      >
                        <span className="text-sm text-muted-foreground">{metric.label}</span>
                        <span className={`text-lg font-semibold ${metric.tone}`}>{metric.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
                  <p className="text-sm font-semibold text-foreground">Built for focused engineering teams</p>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
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
