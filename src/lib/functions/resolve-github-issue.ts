import { inngest } from "@/src/inngest/client";
import prisma from "../prisma";
import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "octokit";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── Retry wrapper (same as resolve-event.ts) ──────────────
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

export const resolveGithubIssue = inngest.createFunction(
  {
    id: "resolve-github-issue",
    name: "Resolve GitHub Issue",
    retries: 2,
    onFailure: async ({ error, event }) => {
      const { jobId } = event.data.event.data;
      await prisma.githubIssueJob.updateMany({
        where: { id: jobId },
        data: {
          status: "FAILED",
          errorMsg: error.message,
          completedAt: new Date(),
        },
      });
    },
  },
  { event: "github/issue.resolve" },
  async ({ event, step }) => {
    const {
      jobId,
      repoId,
      userId,
      issueNumber,
      issueTitle,
      issueBody,
      strategy,
      branchName: initialBranchName,
    } = event.data;

    // ── Validate input ──────────────────────────────────────
    if (!jobId || typeof jobId !== "string") {
      throw new Error("Invalid jobId — aborting job");
    }

    // ── Step 1: Mark as analyzing ───────────────────────────
    await step.run("mark-analyzing", async () => {
      const exists = await prisma.githubIssueJob.findUnique({
        where: { id: jobId },
        select: { id: true, status: true },
      });

      if (!exists) throw new Error(`Job ${jobId} not found in DB`);

      if (exists.status === "COMPLETED") {
        throw new Error(`Job ${jobId} already completed — skipping`);
      }

      await prisma.githubIssueJob.update({
        where: { id: jobId },
        data: {
          status: "FETCHING_CONTEXT",
          startedAt: new Date(),
        },
      });
    });

    // ── Step 2: Fetch context ───────────────────────────────
    // Fetches:
    // 1. Issue comments — often contain stack traces, repro steps, extra context
    // 2. Repo file tree — to find files relevant to the issue
    // 3. File contents — the actual code Claude will fix
    const context = await step.run("fetch-context", async () => {
      const job = await prisma.githubIssueJob.findUnique({
        where: { id: jobId },
        include: {
          repo: true,
          user: {
            include: {
              accounts: { where: { providerId: "github" } },
            },
          },
        },
      });

      if (!job) throw new Error(`Job ${jobId} not found`);

      const accessToken = job.user.accounts[0]?.accessToken;
      if (!accessToken) throw new Error("No GitHub access token found");

      const octokit = new Octokit({ auth: accessToken });
      const [owner, repoName] = job.repo.fullName.split("/");

      // ── Fetch issue comments ──────────────────────────────
      let comments: string[] = [];
      try {
        const commentsRes = await withRetry(() =>
          octokit.rest.issues.listComments({
            owner,
            repo: repoName,
            issue_number: issueNumber,
            per_page: 20,
          }),
        );
        comments = commentsRes.data.map(
          (c) => `@${c.user?.login ?? "unknown"}: ${c.body ?? ""}`,
        );
      } catch (err: any) {
        // Comments are supplementary — log but don't fail the job
        console.warn("[resolve-issue] Failed to fetch comments:", err?.message);
      }

      // ── Fetch repo file tree ──────────────────────────────
      // We get the full file tree and let Claude identify which
      // files are relevant based on the issue description.
      let fileTree: string[] = [];
      try {
        const treeRes = await withRetry(() =>
          octokit.rest.git.getTree({
            owner,
            repo: repoName,
            tree_sha: "HEAD",
            recursive: "1",
          }),
        );
        fileTree = (treeRes.data.tree ?? [])
          .filter(
            (item) =>
              item.type === "blob" &&
              /\.(ts|tsx|js|jsx|py|go|rs|java|cpp|c|cs|php|rb|md|json|yaml|yml|sh|css|scss)$/.test(
                item.path ?? "",
              ) &&
              !item.path?.includes("node_modules") &&
              !item.path?.includes(".next") &&
              !item.path?.includes("dist") &&
              !item.path?.includes("build") &&
              !item.path?.includes("package-lock") &&
              !item.path?.includes("yarn.lock"),
          )
          .map((item) => item.path ?? "");
      } catch (err: any) {
        console.warn(
          "[resolve-issue] Failed to fetch file tree:",
          err?.message,
        );
      }

      // ── Ask Claude which files are relevant ───────────────
      // A cheap fast call — no file contents yet, just paths.
      // Claude picks the most relevant files based on issue description.
      let relevantFilePaths: string[] = [];

      if (fileTree.length > 0) {
        try {
          const filePickerPrompt = `
You are a senior software engineer.
Given the following GitHub issue and a list of files in the repository,
identify which files are most likely relevant to fixing the issue.

ISSUE TITLE: ${issueTitle}

ISSUE DESCRIPTION:
${issueBody ?? "No description provided"}

REPOSITORY FILE TREE:
${fileTree.join("\n")}

Return ONLY a JSON array of file paths (max 5 files, most relevant first).
No explanation, no markdown, just the JSON array.
Example: ["src/components/Button.tsx", "src/utils/auth.ts"]
`;

          const pickerRes = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 500,
            messages: [{ role: "user", content: filePickerPrompt }],
          });

          const pickerText =
            pickerRes.content[0].type === "text"
              ? pickerRes.content[0].text.trim()
              : "";

          const jsonMatch = pickerText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
              // Only keep paths that actually exist in the tree
              relevantFilePaths = parsed
                .filter(
                  (p: any) => typeof p === "string" && fileTree.includes(p),
                )
                .slice(0, 5);
            }
          }
        } catch (err: any) {
          console.warn(
            "[resolve-issue] File picker Claude call failed:",
            err?.message,
          );
        }
      }

      // ── Fetch file contents ───────────────────────────────
      const files: { path: string; content: string }[] = [];
      const skippedFiles: string[] = [];

      for (const filePath of relevantFilePaths) {
        try {
          const res = await withRetry(() =>
            octokit.rest.repos.getContent({
              owner,
              repo: repoName,
              path: filePath,
            }),
          );
          if ("content" in res.data) {
            files.push({
              path: filePath,
              content: Buffer.from(res.data.content, "base64").toString(
                "utf-8",
              ),
            });
          }
        } catch (err: any) {
          console.warn(`[resolve-issue] Skipped ${filePath}:`, err?.message);
          skippedFiles.push(`${filePath} (${err?.message ?? "unknown"})`);
        }
      }

      if (files.length === 0) {
        throw new Error(
          `No relevant files could be fetched. Skipped: ${skippedFiles.join(", ") || "none"}`,
        );
      }

      if (skippedFiles.length > 0) {
        console.warn(
          "[resolve-issue] Skipped files:",
          skippedFiles.join(", "),
        );
      }

      // Update status now that we have context
      await prisma.githubIssueJob.update({
        where: { id: jobId },
        data: { status: "ANALYZING" },
      });

      return {
        files,
        comments,
        accessToken,
        repoFullName: job.repo.fullName,
      };
    });

    // ── Step 3: Generate fix (Claude Pass 1) ────────────────
    const patch = await step.run("generate-fix", async () => {
      const filesContent = context.files
        .map((f: any) => `### File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
        .join("\n\n");

      const commentsBlock =
        context.comments.length > 0
          ? `\n\n## ISSUE COMMENTS\n${context.comments.join("\n\n")}`
          : "";

      const prompt = `
You are a senior software engineer.
Your task is to analyze the GitHub issue below and generate a precise, minimal fix.

--------------------------------
## GITHUB ISSUE
Title: ${issueTitle}

Description:
${issueBody ?? "No description provided"}
${commentsBlock}

--------------------------------
## RELEVANT FILES
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
- If you cannot determine a safe fix, return explanation but set "files" to [].

--------------------------------
## OUTPUT FORMAT (STRICT)
{
  "explanation": "Clear root cause + fix explanation",
  "files": [
    {
      "path": "path/to/file.ts",
      "content": "complete updated file content"
    }
  ],
  "commitMessage": "fix: short meaningful description (closes #${issueNumber})"
}`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8096,
        messages: [{ role: "user", content: prompt }],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "";

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
        throw new Error(
          "Failed to parse Claude JSON response in generate-fix",
        );
      }

      if (!result.files) throw new Error("Claude returned no files array");
      if (result.files.length === 0) {
        throw new Error(
          `Claude could not determine a safe fix: ${result.explanation}`,
        );
      }
      if (!result.commitMessage)
        throw new Error("Claude returned no commit message");

      return result;
    });

    // ── Step 4: Verify fix (Claude Pass 2 — self-critique) ──
    const verified = await step.run("verify-fix", async () => {
      await prisma.githubIssueJob.update({
        where: { id: jobId },
        data: { status: "VERIFYING" },
      });

      const originalFilesContent = context.files
        .map((f: any) => `### File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
        .join("\n\n");

      const proposedFilesContent = patch.files
        .map((f: any) => `### File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
        .join("\n\n");

      const verifyPrompt = `
You are a senior code reviewer with an adversarial mindset.
A junior engineer wrote the following fix for a GitHub issue.
Your job is to find any problems with it and either approve it or correct it.

--------------------------------
## ORIGINAL ISSUE
Title: ${issueTitle}

Description:
${issueBody ?? "No description provided"}

--------------------------------
## ORIGINAL FILES (before fix)
${originalFilesContent}

--------------------------------
## PROPOSED FIX
${proposedFilesContent}

--------------------------------
## REVIEW CHECKLIST
- Does the fix actually solve the issue described?
- Does it introduce any new bugs or regressions?
- Are there null / undefined risks?
- Are types correct (TypeScript if applicable)?
- Is the fix complete or does it only partially address the issue?
- Does it break any other obvious functionality in the same files?

--------------------------------
## STRICT RULES
- Return ONLY valid JSON. No markdown, no extra text.
- If the fix is correct → set verdict to "approved" and return the same files unchanged.
- If the fix has problems → set verdict to "revised" and return corrected files.
- Always return the full file content, never diffs.

--------------------------------
## OUTPUT FORMAT (STRICT)
{
  "verdict": "approved" | "revised",
  "issues_found": ["list of problems found, empty array if approved"],
  "review_note": "brief explanation of your decision",
  "files": [
    {
      "path": "path/to/file.ts",
      "content": "complete file content"
    }
  ]
}`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8096,
        messages: [{ role: "user", content: verifyPrompt }],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "";

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Non-fatal — fall back to original patch
        console.warn(
          "[resolve-issue] Verify step returned invalid JSON — using original patch",
        );
        return {
          verdict: "approved" as const,
          issues_found: [] as string[],
          review_note: "Verification skipped — invalid response from reviewer",
          files: patch.files,
        };
      }

      let result: {
        verdict: "approved" | "revised";
        issues_found: string[];
        review_note: string;
        files: { path: string; content: string }[];
      };

      try {
        result = JSON.parse(jsonMatch[0]);
      } catch {
        // Non-fatal — fall back to original patch
        console.warn(
          "[resolve-issue] Failed to parse verify JSON — using original patch",
        );
        return {
          verdict: "approved" as const,
          issues_found: [] as string[],
          review_note: "Verification skipped — parse error",
          files: patch.files,
        };
      }

      // Save verdict to DB for debugging + UI display
      await prisma.githubIssueJob.update({
        where: { id: jobId },
        data: {
          verifyVerdict: result.verdict,
          verifyNote: result.review_note,
        },
      });

      console.log(
        `[resolve-issue] Verify verdict: ${result.verdict}`,
        result.issues_found.length > 0
          ? `Issues found: ${result.issues_found.join(", ")}`
          : "No issues found",
      );

      return result;
    });

    // ── Step 5: Create branch + commit + PR ─────────────────
    const prResult = await step.run("create-pr", async () => {
      await prisma.githubIssueJob.update({
        where: { id: jobId },
        data: { status: "CREATING_PR" },
      });

      const octokit = new Octokit({ auth: context.accessToken });
      const [owner, repoName] = context.repoFullName.split("/");

      // Get default branch + latest SHA
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

      // Resolve final branch name
      let branchName: string;
      if (strategy === "same") {
        branchName = defaultBranch;
      } else {
        branchName = initialBranchName ?? `fix/issue-${issueNumber}`;
      }

      // Create branch (skip if fixing on default branch)
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
              `[resolve-issue] Branch ${branchName} already exists — continuing`,
            );
          } else {
            throw err;
          }
        }
      }

      // Use verified files (may be revised by Step 4)
      const filesToCommit = verified.files;

      // Commit each file
      for (const file of filesToCommit) {
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
            throw new Error(
              `Failed to get SHA for ${file.path}: ${err?.message}`,
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

      // Check if PR already exists (idempotent)
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
        console.warn(
          `[resolve-issue] PR already exists: #${existing.number}`,
        );
        return {
          prUrl: existing.html_url,
          prNumber: existing.number,
          branchName,
        };
      }

      // Build PR body
      const verifyBadge =
        verified.verdict === "revised"
          ? "⚠️ _Fix was revised by AI reviewer before merge._"
          : "✅ _Fix was reviewed and approved by AI reviewer._";

      const issuesFoundBlock =
        verified.issues_found?.length > 0
          ? `\n### 🔍 Issues Found by Reviewer\n${verified.issues_found.map((i: string) => `- ${i}`).join("\n")}\n`
          : "";

      const prBody = [
        "## 🤖 Auto-fix by GitHubResolver",
        "",
        `Closes #${issueNumber}`,
        "",
        "### 📋 Issue",
        `**${issueTitle}**`,
        "",
        "### 🛠 What Was Fixed",
        patch.explanation,
        "",
        issuesFoundBlock,
        "### 🔎 AI Review",
        verifyBadge,
        verified.review_note ? `> ${verified.review_note}` : "",
        "",
        "### 📁 Files Changed",
        filesToCommit.map((f: any) => `- \`${f.path}\``).join("\n"),
        "",
        "---",
        "_This PR was automatically generated by [GitHubResolver](https://github.com) using Claude AI._",
        "_Please review carefully before merging._",
      ]
        .filter((line) => line !== undefined)
        .join("\n");

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

    // ── Step 6: Mark completed ───────────────────────────────
    await step.run("mark-completed", async () => {
      await prisma.githubIssueJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          prUrl: prResult.prUrl,
          prNumber: prResult.prNumber,
          branchName: prResult.branchName,
          completedAt: new Date(),
        },
      });
    });

    return {
      success: true,
      jobId,
      prUrl: prResult.prUrl,
      prNumber: prResult.prNumber,
    };
  },
);