import { BrandMark, GitHubIcon } from "@/components/brand-mark";
import { GithubSignInButton } from "@/components/github-sign-in-button";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden px-6 py-5 sm:px-8 lg:px-12">
      <div className="hero-surface absolute inset-0" />
      <div className="grid-surface grid-surface-lg absolute inset-0 opacity-30" />

      <div className="relative flex h-full w-full items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,420px)] lg:items-center lg:gap-12">
          <section className="space-y-5">
            <BrandMark compact />
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/80">
                Production-ready repository ops
              </p>
              <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Keep broken checks, merge blockers, and review requests in a single clear workflow.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                Sign in with GitHub to connect repositories, monitor issues in real time, and trigger AI-assisted fixes without changing your team&apos;s core workflow.
              </p>
            </div>

            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                "Detects pull request failures and merge conflicts",
                "Uses AI to prepare contextual fixes and PRs",
                "Keeps actions, statuses, and next steps easy to scan",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <Card className="border-border/80 bg-card/92 shadow-md">
            <CardContent className="space-y-5 p-5 sm:p-6">
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

              <GithubSignInButton className="w-full shadow-md" />

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
