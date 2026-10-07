import Link from "next/link";
import { ArrowLeft, Bot, FolderGit2, ShieldCheck } from "lucide-react";

import { BrandMark, GitHubIcon } from "@/components/brand-mark";
import { GithubSignInButton } from "@/components/github-sign-in-button";

const trustPoints = [
  {
    icon: FolderGit2,
    title: "Connect repos",
    body: "Public or private—managed from one place.",
  },
  {
    icon: Bot,
    title: "AI-assisted fixes",
    body: "Claude drafts patches and opens PRs.",
  },
  {
    icon: ShieldCheck,
    title: "Review stays yours",
    body: "Nothing merges without your approval.",
  },
] as const;

export default function LoginPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <div className="hero-surface absolute inset-0" />
      <div className="grid-surface grid-surface-lg absolute inset-0 opacity-25" />
      <div className="auth-orb -left-16 top-8 h-72 w-72 bg-primary/25" />
      <div
        className="auth-orb right-0 bottom-0 h-80 w-80 bg-info/12"
        style={{ animationDelay: "1.5s" }}
      />

      <div className="relative flex h-full w-full flex-col px-6 py-5 sm:px-8 lg:px-14">
        <header className="auth-fade-up flex shrink-0 items-center justify-between">
          <BrandMark compact />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-muted-foreground backdrop-blur-md transition-colors hover:bg-white/15 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
        </header>

        <section className="flex min-h-0 flex-1 flex-col justify-center py-4 lg:py-6">
          <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,400px)] lg:gap-16">
            <div className="auth-fade-up-delay space-y-6">
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/85 sm:text-sm">
                  Sign in
                </p>
                <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
                  Connect GitHub and start resolving issues.
                </h1>
                <p className="max-w-lg text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                  One OAuth flow unlocks repo monitoring, AI resolve jobs, and review-ready pull requests.
                </p>
              </div>

              <ul className="hidden space-y-3 sm:block">
                {trustPoints.map(({ icon: Icon, title, body }) => (
                  <li key={title} className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{title}</p>
                      <p className="text-sm text-muted-foreground">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="auth-fade-up-delay-2 glass-panel rounded-2xl p-6 sm:p-7">
              <div className="space-y-5">
                <div className="space-y-3 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/15 text-primary">
                    <GitHubIcon className="size-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                      Continue with GitHub
                    </h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Authorize access to monitor repos and open fix PRs on your behalf.
                    </p>
                  </div>
                </div>

                <GithubSignInButton className="w-full shadow-lg shadow-primary/20" />

                <p className="text-center text-xs leading-5 text-muted-foreground">
                  Permissions follow your GitHub scopes. You can disconnect repos anytime from Settings.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
