import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import { toUserFacingTriageError } from "@/src/lib/triage/errors";
import { triageIssue, triageIssuesBatch } from "@/src/lib/triage/service";
import { headers } from "next/headers";
import { z } from "zod";

const MAX_BATCH = 10;

const bodySchema = z
  .object({
    repoId: z.string().min(1),
    issueNumber: z.number().int().positive().optional(),
    issueNumbers: z.array(z.number().int().positive()).max(MAX_BATCH).optional(),
    force: z.boolean().optional(),
  })
  .refine(
    (data) =>
      typeof data.issueNumber === "number" ||
      (Array.isArray(data.issueNumbers) && data.issueNumbers.length > 0),
    { message: "issueNumber or issueNumbers is required" },
  );

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { repoId, issueNumber, issueNumbers, force } = parsed.data;

  const repo = await prisma.repo.findUnique({ where: { id: repoId } });
  if (!repo || repo.userId !== session.user.id) {
    return Response.json({ error: "Repo not found" }, { status: 404 });
  }

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, providerId: "github" },
  });
  if (!account?.accessToken) {
    return Response.json(
      { error: "No GitHub access token found" },
      { status: 401 },
    );
  }

  const base = {
    userId: session.user.id,
    repoId,
    repoFullName: repo.fullName,
    accessToken: account.accessToken,
    force: force ?? false,
  };

  try {
    if (issueNumbers && issueNumbers.length > 0) {
      const unique = [...new Set(issueNumbers)].slice(0, MAX_BATCH);
      const { results, errors } = await triageIssuesBatch({
        ...base,
        issueNumbers: unique,
      });
      return Response.json({ results, errors });
    }

    const triage = await triageIssue({
      ...base,
      issueNumber: issueNumber!,
    });
    return Response.json({ triage });
  } catch (err: unknown) {
    const userError = toUserFacingTriageError(err);
    console.error("[issues/triage] failed:", {
      repoId,
      issueNumber,
      errorCategory: userError.category,
      error: userError.internalMessage,
    });
    return Response.json({ error: userError.message }, { status: 502 });
  }
}
