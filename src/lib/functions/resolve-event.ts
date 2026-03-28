import { inngest } from "@/src/inngest/client";
import prisma from "../prisma";
import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "octokit";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── Retry wrapper for GitHub API calls ───────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000,
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isLast = attempt === retries;
      const isRateLimit = err?.status === 429;
      const isTransient = [500, 502, 503].includes(err?.status);

      if (isLast || (!isRateLimit && !isTransient)) throw err;

      const wait = isRateLimit ? 60000 : delayMs * attempt;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("Retry failed");
}

export const resolveGithubEvent = inngest.createFunction(
  {
    id: "resolve-github-event",
    name: "Resolve GitHub Event",
    retries: 2,
    onFailure: async ({ error, event }) => {
      // Access original event data through event.data.event.data
      const { eventId } = event.data.event.data;

      await prisma.githubEvent.updateMany({
        where: { id: eventId },
        data: { status: "FAILED" },
      });

      await prisma.resolveJob.updateMany({
        where: { eventId },
        data: {
          status: "FAILED",
          errorMsg: error.message,
          completedAt: new Date(),
        },
      });
    },
  },
  { event: "github/event.resolve" },
  async ({ event, step }) => {
    const { eventId } = event.data;

    // ── Validate input ────────────────────────────────────────
    if (!eventId || typeof eventId !== "string") {
      throw new Error("Invalid eventId — aborting job");
    }

    // ── Step 1: Mark as resolving ─────────────────────────────
    await step.run("mark-resolving", async () => {
      const exists = await prisma.githubEvent.findUnique({
        where: { id: eventId },
        select: { id: true, status: true },
      });

      if (!exists) throw new Error(`Event ${eventId} not found in DB`);

      // Don't re-process already resolved events
      if (exists.status === "RESOLVED") {
        throw new Error(`Event ${eventId} already resolved — skipping`);
      }

      // Update event status
      await prisma.githubEvent.update({
        where: { id: eventId },
        data: { status: "RESOLVING" },
      });

      // Update job status + startedAt
      await prisma.resolveJob.updateMany({
        where: { eventId },
        data: {
          status: "FETCHING_CONTEXT",
          startedAt: new Date(),
        },
      });
    });

    // ── Step 2: Fetch context from GitHub ─────────────────────
    const context = await step.run("fetch-context", async () => {
      const githubEvent = await prisma.githubEvent.findUnique({
        where: { id: eventId },
        include: {
          repo: true,
          user: {
            include: {
              accounts: { where: { providerId: "github" } },
            },
          },
        },
      });

      if (!githubEvent) throw new Error(`Event ${eventId} not found`);

      const accessToken = githubEvent.user.accounts[0]?.accessToken;
      if (!accessToken)
        throw new Error("No GitHub access token found for user");

      const octokit = new Octokit({ auth: accessToken });
      const payload = githubEvent.payload as any;
      const [owner, repoName] = githubEvent.repo.fullName.split("/");

      const files: { path: string; content: string }[] = [];
      console.log("FILEKSHVKV", files);
      const skippedFiles: string[] = [];
      let errorContext = "";

      // Helper to fetch a single file safely
      async function fetchFile(path: string, ref?: string) {
        console.log("[fetchFile] Attempting:", path, "ref:", ref ?? "none");
        try {
          const response = await withRetry(() =>
            octokit.rest.repos.getContent({
              owner,
              repo: repoName,
              path,
              ...(ref ? { ref } : {}),
            }),
          );
          if ("content" in response.data) {
            console.log("[fetchFile] Success:", path);
            files.push({
              path,
              content: Buffer.from(response.data.content, "base64").toString(
                "utf-8",
              ),
            });
          }
        } catch (err: any) {
          // Log skipped files instead of silently ignoring
          console.log(
            "[fetchFile] Failed:",
            path,
            "Error:",
            err?.message,
            "Status:",
            err?.status,
          );
          skippedFiles.push(`${path} (${err?.message ?? "unknown error"})`);
        }
      }

      if (githubEvent.type === "CI_FAILURE") {
        const sha = payload.check_run?.head_sha ?? payload.after;
        if (!sha) throw new Error("No SHA found in CI_FAILURE payload");

        const commit = await withRetry(() =>
          octokit.rest.repos.getCommit({ owner, repo: repoName, ref: sha }),
        );

        console.log(
          "[resolve-event] SHA:",
          sha,
          "\n[resolve-event] All files:",
          commit.data.files?.map((f) => `${f.filename} (${f.status})`),
        );

        const changedFiles = (commit.data.files ?? [])
          .filter((f) =>
            f.filename.match(
              /\.(ts|tsx|js|jsx|py|go|rs|java|cpp|c|cs|php|rb)$/,
            ),
          )
          .slice(0, 5);

        console.log(
          "[resolve-event] Matched files:",
          changedFiles.map((f) => f.filename),
        );
        console.log("[resolve-event] changedFiles to fetch:", changedFiles);
        for (const file of changedFiles) {
          await fetchFile(file.filename, sha);
        }

        errorContext = [
          `CI check failed: ${payload.check_run?.name ?? "unknown check"}`,
          `Conclusion: ${payload.check_run?.conclusion ?? "failure"}`,
          `Summary: ${payload.check_run?.output?.summary ?? "No output available"}`,
          `Details: ${payload.check_run?.output?.text ?? ""}`,
        ].join("\n");
      }

      if (githubEvent.type === "PR_CONFLICT") {
        const prNumber = payload.pull_request?.number;
        if (!prNumber)
          throw new Error("No PR number found in PR_CONFLICT payload");

        const prFiles = await withRetry(() =>
          octokit.rest.pulls.listFiles({
            owner,
            repo: repoName,
            pull_number: prNumber,
          }),
        );

        const relevantFiles = prFiles.data
          .filter((f) =>
            f.filename.match(
              /\.(ts|tsx|js|jsx|py|go|rs|java|cpp|c|cs|php|rb|md|json|yaml|yml|env|sh)$/,
            ),
          )
          .slice(0, 5);

        for (const file of relevantFiles) {
          await fetchFile(file.filename);
        }

        errorContext = [
          `Merge conflict in PR #${prNumber}: ${payload.pull_request?.title}`,
          `Base branch: ${payload.pull_request?.base?.ref}`,
          `Head branch: ${payload.pull_request?.head?.ref}`,
        ].join("\n");
      }

      if (githubEvent.type === "CODE_ERROR") {
        const commits = payload.commits ?? [];
        const latestCommit = commits[commits.length - 1];

        if (!latestCommit)
          throw new Error("No commits found in CODE_ERROR payload");

        const commitSha = latestCommit.id ?? latestCommit.sha;
        if (!commitSha)
          throw new Error("No commit SHA found in CODE_ERROR payload");

        console.log("[resolve-event] CODE_ERROR SHA:", commitSha);

        const changedFiles = [
          ...(latestCommit.added ?? []),
          ...(latestCommit.modified ?? []),
        ]
          .filter((f: string) =>
            f.match(
              /\.(ts|tsx|js|jsx|py|go|rs|java|cpp|c|cs|php|rb|md|json|yaml|yml|env|sh)$/,
            ),
          )
          .slice(0, 5);

        for (const filePath of changedFiles) {
          await fetchFile(filePath, commitSha);
        }

        console.log("[resolve-event] CODE_ERROR files:", [
          ...(latestCommit.added ?? []),
          ...(latestCommit.modified ?? []),
        ]);

        errorContext = [
          `Error in push: ${latestCommit.message}`,
          `Commit SHA: ${commitSha}`,
          `Author: ${latestCommit.author?.name ?? "unknown"}`,
          `Timestamp: ${latestCommit.timestamp ?? "unknown"}`,
        ].join("\n");
      }

      if (!files.length) {
        throw new Error(
          `No files could be fetched. Skipped: ${skippedFiles.join(", ") || "none"}`,
        );
      }

      if (skippedFiles.length) {
        console.warn(
          `[resolve-event] Skipped files: ${skippedFiles.join(", ")}`,
        );
      }

      return {
        files,
        errorContext,
        repoFullName: githubEvent.repo.fullName,
        accessToken,
        eventType: githubEvent.type,
      };
    });

    // ── Step 3: Analyze with Claude ───────────────────────────
    const patch = await step.run("analyze-with-claude", async () => {
      await prisma.resolveJob.updateMany({
        where: { eventId },
        data: { status: "ANALYZING" },
      });

      const filesContent = context.files
        .map((f: any) => `### File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
        .join("\n\n");

      const prompt = `
      You are a senior software engineer and code reviewer.

      Your task is to analyze the provided issue and code, then generate a precise and minimal fix.

      --------------------------------
      ## CONTEXT
      Issue:
      ${context.errorContext}

      Files:
      ${filesContent}

      --------------------------------
      ## OBJECTIVE
      - Identify the exact root cause of the issue.
      - Fix ONLY what is necessary to resolve the issue.
      - Do NOT introduce unrelated changes, refactors, or formatting changes.
      - Preserve existing logic unless it is directly related to the bug.

      --------------------------------
      ## STRICT RULES
      - Return ONLY valid JSON. No markdown, no explanations outside JSON.
      - Do NOT wrap the response in \`\`\` or add any extra text.
      - Ensure JSON is syntactically correct and parsable.
      - Always return FULL file content (not diffs or partial snippets).
      - If multiple files need changes, include all of them.
      - Do NOT change file paths.
      - Do NOT remove unrelated code.
      - If you cannot determine a safe fix, return an explanation but set "files" to an empty array.

      --------------------------------
      ## EDGE CASE HANDLING
      - Handle null/undefined safely.
      - Ensure type correctness (TypeScript if applicable).
      - Avoid runtime errors.
      - Maintain compatibility with existing code.

      --------------------------------
      ## OUTPUT FORMAT (STRICT)
      {
        "explanation": "Clear and concise root cause + fix explanation",
        "files": [
          {
            "path": "path/to/file.ts",
            "content": "complete updated file content"
          }
        ],
        "commitMessage": "fix: short, meaningful description"
      }`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8096,
        messages: [{ role: "user", content: prompt }],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "";

      // Extract JSON block safely
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(
          `Claude did not return valid JSON. Response: ${responseText.slice(0, 200)}`,
        );
      }

      let result: {
        explanation: string;
        files: { path: string; content: string }[];
        commitMessage: string;
      };

      try {
        result = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error("Failed to parse Claude JSON response");
      }

      // Validate structure
      if (!result.files) {
        throw new Error("Claude returned no files array");
      }

      if (result?.files.length === 0) {
        throw new Error(
          `Claude could not determine a safe fix: ${result.explanation}`,
        );
      }

      if (!result.commitMessage) {
        throw new Error("Claude returned no commit message");
      }

      return result;
    });

    // ── Step 4: Create branch + commit + PR ───────────────────
    const prResult = await step.run("create-pr", async () => {
      const octokit = new Octokit({ auth: context.accessToken });
      const [owner, repoName] = context.repoFullName.split("/");

      // At the start of create-pr step
      await prisma.resolveJob.updateMany({
        where: { eventId },
        data: { status: "CREATING_PR" },
      });
      // Get default branch
      const repoData = await withRetry(() =>
        octokit.rest.repos.get({ owner, repo: repoName }),
      );
      const defaultBranch = repoData.data.default_branch;

      const branchRef = await withRetry(() =>
        octokit.rest.git.getRef({
          owner,
          repo: repoName,
          ref: `heads/${defaultBranch}`,
        }),
      );
      const baseSha = branchRef.data.object.sha;
      // Determine branch name based on strategy
      const { strategy, customBranch } = event.data;
      let branchName: string;
      if (strategy === "same") {
        const githubEvent = await prisma.githubEvent.findUnique({
          where: { id: eventId },
          select: { sourceBranch: true },
        });
        branchName = githubEvent?.sourceBranch ?? defaultBranch;
      } else if (strategy === "custom" && customBranch) {
        branchName = customBranch;
      } else {
        branchName = `fix/auto-${eventId.slice(0, 8)}`;
      }

      // Only create a new branch if not fixing in same branch
      if (strategy !== "same") {
        try {
          await withRetry(() =>
            octokit.rest.git.createRef({
              owner,
              repo: repoName,
              ref: `refs/heads/${branchName}`,
              sha: baseSha,
            }),
          );
        } catch (err: any) {
          if (err?.status === 422) {
            console.warn(
              `[resolve-event] Branch ${branchName} already exists — continuing`,
            );
          } else {
            throw err;
          }
        }
      }

      // Commit each file
      for (const file of patch.files) {
        let currentFileSha: string | undefined;

        try {
          const existing = await withRetry(() =>
            octokit.rest.repos.getContent({
              owner,
              repo: repoName,
              path: file.path,
              ref: branchName,
            }),
          );
          if ("sha" in existing.data) {
            currentFileSha = existing.data.sha;
          }
        } catch (err: any) {
          if (err?.status !== 404) {
            // 404 means new file — anything else is a real error
            throw new Error(
              `Failed to get existing file SHA for ${file.path}: ${err?.message}`,
            );
          }
        }

        await withRetry(() =>
          octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo: repoName,
            path: file.path,
            message: patch.commitMessage,
            content: Buffer.from(file.content).toString("base64"),
            branch: branchName,
            ...(currentFileSha ? { sha: currentFileSha } : {}),
          }),
        );
      }

      // Check if PR already exists for this branch (idempotent)
      const existingPRs = await withRetry(() =>
        octokit.rest.pulls.list({
          owner,
          repo: repoName,
          head: `${owner}:${branchName}`,
          state: "open",
        }),
      );

      if (existingPRs.data.length > 0) {
        const existing = existingPRs.data[0];
        console.warn(`[resolve-event] PR already exists: #${existing.number}`);
        return {
          prUrl: existing.html_url,
          prNumber: existing.number,
          branchName,
        };
      }

      // Create PR with structured body
      const prBody = [
        "## 🤖 Auto-fix by GitHubResolver",
        "",
        "### 🔍 Issue Detected",
        "```",
        context.errorContext,
        "```",
        "",
        "### 🛠 What Was Fixed",
        patch.explanation,
        "",
        "### 📁 Files Changed",
        patch.files.map((f: any) => `- \`${f.path}\``).join("\n"),
        "",
        "---",
        "_This PR was automatically generated by [GitHubResolver](https://github.com) using Claude AI._",
        "_Please review carefully before merging._",
      ].join("\n");

      const pr = await withRetry(() =>
        octokit.rest.pulls.create({
          owner,
          repo: repoName,
          title: patch.commitMessage,
          body: prBody,
          head: branchName,
          base: defaultBranch,
        }),
      );

      return {
        prUrl: pr.data.html_url,
        prNumber: pr.data.number,
        branchName,
      };
    });

    // ── Step 5: Mark resolved in DB ───────────────────────────
    await step.run("mark-resolved", async () => {
      await prisma.githubEvent.update({
        where: { id: eventId },
        data: { status: "RESOLVED" },
      });

      // Sync ResolveJob with PR details
      await prisma.resolveJob.updateMany({
        where: { eventId },
        data: {
          status: "COMPLETED",
          prUrl: prResult.prUrl,
          prNumber: prResult.prNumber,
          completedAt: new Date(),
        },
      });
    });

    return {
      success: true,
      eventId,
      prUrl: prResult.prUrl,
      prNumber: prResult.prNumber,
    };
  },
);

// ✅ Input validation     — checks eventId exists before any DB call
// ✅ Already resolved     — skips re-processing resolved events
// ✅ fetchFile helper     — logs skipped files instead of silent catch {}
// ✅ withRetry wrapper    — handles rate limits + transient GitHub errors
// ✅ Idempotent branch    — 422 on branch exists is handled gracefully
// ✅ Duplicate PR check   — queries open PRs before creating a new one
// ✅ Commit error clarity — 404 vs real error distinction on file SHA fetch
// ✅ Claude validation    — validates JSON structure after parsing
// ✅ Better PR body       — structured sections with files changed list
// ✅ Bigger max_tokens    — 8096 instead of 4096 for larger files
