import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "octokit";

import prisma from "@/src/lib/prisma";
import {
  buildTriagePrompt,
  TRIAGE_MODEL,
  TRIAGE_PROMPT_VERSION,
} from "@/src/lib/prompts/triage-issue.v1";
import { toUserFacingTriageError } from "@/src/lib/triage/errors";
import { parseTriageModelOutput } from "@/src/lib/triage/schema";
import {
  getTriagesForRepo,
  toTriageView,
  type TriageView,
} from "@/src/lib/triage/view";

export { getTriagesForRepo, toTriageView, type TriageView };

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type TriageIssueInput = {
  userId: string;
  repoId: string;
  repoFullName: string;
  accessToken: string;
  issueNumber: number;
  force?: boolean;
};

function isFreshCache(
  existing: {
    errorMsg: string | null;
    issueUpdatedAt: Date;
  } | null,
  issueUpdatedAt: Date,
  force?: boolean,
): boolean {
  return Boolean(
    existing &&
      !force &&
      !existing.errorMsg &&
      existing.issueUpdatedAt.getTime() >= issueUpdatedAt.getTime(),
  );
}

/**
 * Triage a single GitHub issue. Uses cached IssueTriage when issueUpdatedAt
 * is unchanged; otherwise calls Claude, validates with Zod, and upserts.
 * On failure: does not invent a score. Throws a user-safe TriageUserError.
 */
export async function triageIssue(
  input: TriageIssueInput,
): Promise<TriageView> {
  const startedAt = Date.now();
  const [owner, repoName] = input.repoFullName.split("/");
  const octokit = new Octokit({ auth: input.accessToken });

  try {
    let issueRes;
    try {
      issueRes = await octokit.rest.issues.get({
        owner,
        repo: repoName,
        issue_number: input.issueNumber,
      });
    } catch (err: unknown) {
      throw toUserFacingTriageError(
        err instanceof Error ? new Error(`GitHub: ${err.message}`) : err,
      );
    }

    if (issueRes.data.pull_request) {
      throw toUserFacingTriageError(
        new Error("Cannot triage a pull request as an issue"),
      );
    }

    const issueUpdatedAt = new Date(issueRes.data.updated_at);
    let existing = await prisma.issueTriage.findUnique({
      where: {
        repoId_issueNumber: {
          repoId: input.repoId,
          issueNumber: input.issueNumber,
        },
      },
    });

    if (isFreshCache(existing, issueUpdatedAt, input.force)) {
      console.info("[triage] cache hit", {
        repoId: input.repoId,
        issueNumber: input.issueNumber,
        promptVersion: existing!.promptVersion,
        model: existing!.model,
        durationMs: Date.now() - startedAt,
        success: true,
      });
      return toTriageView(existing!, issueUpdatedAt);
    }

    const commentsRes = await octokit.rest.issues.listComments({
      owner,
      repo: repoName,
      issue_number: input.issueNumber,
      per_page: 20,
    });

    const labels = (issueRes.data.labels ?? []).map((l) =>
      typeof l === "string" ? l : l.name ?? "",
    );
    const comments = commentsRes.data
      .map((c) => c.body ?? "")
      .filter((body) => body.length > 0)
      .slice(0, 10);

    const prompt = buildTriagePrompt({
      title: issueRes.data.title,
      body: issueRes.data.body ?? "",
      labels,
      comments,
    });

    // Concurrency: another request may have filled the cache while we fetched comments
    existing = await prisma.issueTriage.findUnique({
      where: {
        repoId_issueNumber: {
          repoId: input.repoId,
          issueNumber: input.issueNumber,
        },
      },
    });
    if (isFreshCache(existing, issueUpdatedAt, input.force)) {
      console.info("[triage] cache hit (pre-claude recheck)", {
        repoId: input.repoId,
        issueNumber: input.issueNumber,
        promptVersion: existing!.promptVersion,
        model: existing!.model,
        durationMs: Date.now() - startedAt,
        success: true,
      });
      return toTriageView(existing!, issueUpdatedAt);
    }

    let response;
    try {
      response = await anthropic.messages.create({
        model: TRIAGE_MODEL,
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });
    } catch (err: unknown) {
      throw toUserFacingTriageError(
        err instanceof Error ? new Error(`Anthropic: ${err.message}`) : err,
      );
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw toUserFacingTriageError(
        new Error("Triage model returned no text content"),
      );
    }

    let result;
    try {
      result = parseTriageModelOutput(textBlock.text);
    } catch (err: unknown) {
      throw toUserFacingTriageError(err);
    }

    const saved = await prisma.issueTriage.upsert({
      where: {
        repoId_issueNumber: {
          repoId: input.repoId,
          issueNumber: input.issueNumber,
        },
      },
      create: {
        userId: input.userId,
        repoId: input.repoId,
        issueNumber: input.issueNumber,
        issueUpdatedAt,
        confidence: result.confidence,
        effort: result.effort,
        risk: result.risk,
        reason: result.reason,
        model: TRIAGE_MODEL,
        promptVersion: TRIAGE_PROMPT_VERSION,
        provider: "anthropic",
        errorMsg: null,
      },
      update: {
        issueUpdatedAt,
        confidence: result.confidence,
        effort: result.effort,
        risk: result.risk,
        reason: result.reason,
        model: TRIAGE_MODEL,
        promptVersion: TRIAGE_PROMPT_VERSION,
        provider: "anthropic",
        errorMsg: null,
      },
    });

    console.info("[triage] success", {
      repoId: input.repoId,
      issueNumber: input.issueNumber,
      triageId: saved.id,
      confidence: result.confidence,
      effort: result.effort,
      risk: result.risk,
      promptVersion: TRIAGE_PROMPT_VERSION,
      model: TRIAGE_MODEL,
      durationMs: Date.now() - startedAt,
      success: true,
    });

    return toTriageView(saved, issueUpdatedAt);
  } catch (err: unknown) {
    const userError = toUserFacingTriageError(err);
    console.error("[triage] failure", {
      repoId: input.repoId,
      issueNumber: input.issueNumber,
      promptVersion: TRIAGE_PROMPT_VERSION,
      model: TRIAGE_MODEL,
      durationMs: Date.now() - startedAt,
      success: false,
      errorCategory: userError.category,
      error: userError.internalMessage,
    });

    try {
      const existing = await prisma.issueTriage.findUnique({
        where: {
          repoId_issueNumber: {
            repoId: input.repoId,
            issueNumber: input.issueNumber,
          },
        },
      });
      if (existing) {
        await prisma.issueTriage.update({
          where: { id: existing.id },
          data: { errorMsg: userError.internalMessage },
        });
      }
    } catch {
      // swallow secondary DB errors
    }

    throw userError;
  }
}

export async function triageIssuesBatch(
  input: Omit<TriageIssueInput, "issueNumber"> & { issueNumbers: number[] },
): Promise<{
  results: TriageView[];
  errors: { issueNumber: number; error: string }[];
}> {
  const results: TriageView[] = [];
  const errors: { issueNumber: number; error: string }[] = [];

  for (const issueNumber of input.issueNumbers) {
    try {
      const view = await triageIssue({ ...input, issueNumber });
      results.push({ ...view, issueNumber });
    } catch (err: unknown) {
      const userError = toUserFacingTriageError(err);
      errors.push({ issueNumber, error: userError.message });
    }
  }

  return { results, errors };
}
