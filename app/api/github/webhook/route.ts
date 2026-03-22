import { inngest } from "@/src/inngest/client";
import prisma from "@/src/lib/prisma";
import * as crypto from "crypto";
import { headers } from "next/headers";

function verifyGithubSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export async function POST(req: Request) {
  const headersList = await headers();
  const signature = headersList.get("x-hub-signature-256");
  const event = headersList.get("x-github-event");
  const deliveryId = headersList.get("x-github-delivery");

  // 1. Validate signature exists
  if (!signature || !event) {
    return Response.json({ error: "Missing headers" }, { status: 400 });
  }

  const data = await req.text();

  // 2. Verify signature if webhook secret is set
  if (process.env.GITHUB_WEBHOOK_SECRET) {
    const isValid = verifyGithubSignature(
      data,
      signature,
      process.env.GITHUB_WEBHOOK_SECRET,
    );
    if (!isValid) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const payload = JSON.parse(data);
  const repoGithubId = payload.repository?.id;

  if (!repoGithubId) {
    return Response.json({ received: true });
  }

  // 3. Find the repo in our DB
  const repo = await prisma.repo.findUnique({
    where: { githubId: repoGithubId },
    include: { user: true },
  });
  if (!repo) {
    return Response.json({ received: true });
  }

  // 4. Parse event and decide if it's an error worth tracking
  const githubEvent = parseGithubEvent(event, payload);
  if (!githubEvent) {
    return Response.json({ received: true });
  }

  // Check for existing unresolved event of same type for same repo
  const existing = await prisma.githubEvent.findFirst({
    where: {
      repoId: repo.id,
      type: githubEvent.type,
      status: { in: ["PENDING", "RESOLVING"] },
      createdAt: {
        // Within last 10 minutes — same PR burst
        gte: new Date(Date.now() - 10 * 60 * 1000),
      },
    },
  });

  if (existing) {
    // Already tracking this type of error — don't create duplicate
    return Response.json({ received: true });
  }

  // 5. Save event to DB
  const savedEvent = await prisma.githubEvent.create({
    data: {
      userId: repo.userId,
      repoId: repo.id,
      type: githubEvent.type,
      title: githubEvent.title,
      description: githubEvent.description,
      payload: payload,
      status: "PENDING",
    },
  });

  // 6. Trigger Inngest job
  await inngest.send({
    name: "github/event.resolve",
    data: {
      eventId: savedEvent.id,
      repoId: repo.id,
      userId: repo.userId,
      type: githubEvent.type,
    }
  })

  return Response.json({ received: true });
}

function parseGithubEvent(event: string, payload: any) {
  // CI check failed
  if (event === "check_run" && payload.action === "completed") {
    if (payload.check_run?.conclusion === "failure") {
      return {
        type: "CI_FAILURE" as const,
        title: `CI Failed: ${payload.check_run.name}`,
        description: `Check run failed on ${payload.repository.full_name} — ${payload.check_run.html_url}`,
      };
    }
  }

  // PR opened or synchronized
  if (event === "pull_request") {
    if (["opened", "synchronize", "reopened"].includes(payload.action)) {
      if (payload.pull_request?.mergeable === false) {
        return {
          type: "PR_CONFLICT" as const,
          title: `Merge Conflict: ${payload.pull_request.title}`,
          description: `PR #${payload.pull_request.number} has a merge conflict in ${payload.repository.full_name}`,
        };
      }
    }
  }

  // Push with error keywords in commit message
  if (event === "push") {
    const commits = payload.commits ?? [];
    const errorCommit = commits.find((c: any) =>
      /fix|error|bug|fail|crash/i.test(c.message),
    );
    if (errorCommit) {
      return {
        type: "CODE_ERROR" as const,
        title: `Error Push: ${errorCommit.message}`,
        description: `Push to ${payload.repository.full_name} — ${errorCommit.message}`,
      };
    }
  }

  return null;
}
