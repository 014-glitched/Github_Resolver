import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import { headers } from "next/headers";

export async function POST(req: Request) {
  // 1. Check session
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse request body
  const body = await req.json();
  const { githubId, name, fullName, isPrivate } = body;

  if (!githubId || !name || !fullName) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  // 3. Get GitHub access token
  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      providerId: "github",
    },
  });

  if (!account?.accessToken) {
    return Response.json(
      { error: "Github account not connected" },
      { status: 400 },
    );
  }

  // 4. Register webhook on GitHub (include pull_request_review for Phase 2 outcomes)
  const webhookUrl = `${process.env.BETTER_AUTH_URL}/api/github/webhook`;
  const webhookEvents = [
    "pull_request",
    "pull_request_review",
    "check_run",
    "check_suite",
    "push",
  ];

  // Best-effort: refresh events on an existing hook for already-connected repos
  const existingRepo = await prisma.repo.findUnique({ where: { githubId } });
  if (existingRepo?.webhookId) {
    try {
      await fetch(
        `https://api.github.com/repos/${fullName}/hooks/${existingRepo.webhookId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${account.accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            active: true,
            events: webhookEvents,
          }),
        },
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[connect] webhook update failed:", message);
    }
  }

  const webhookResponse = await fetch(
    `https://api.github.com/repos/${fullName}/hooks`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "web",
        active: true,
        events: webhookEvents,
        config: {
          url: webhookUrl,
          content_type: "json",
          insecure_ssl: "0",
          secret: process.env.GITHUB_WEBHOOK_SECRET,
        },
      }),
    },
  );

  let webhook: { id: number };

  if (webhookResponse.ok) {
    webhook = await webhookResponse.json();
  } else {
    const error = await webhookResponse.json();
    // Hook may already exist — keep prior webhookId if we refreshed events above
    if (existingRepo?.webhookId && webhookResponse.status === 422) {
      webhook = { id: existingRepo.webhookId };
      console.warn("[connect] webhook already exists; reused webhookId", {
        webhookId: existingRepo.webhookId,
      });
    } else {
      return Response.json(
        { error: "Failed to register webhook on Github", details: error },
        { status: 400 },
      );
    }
  }

  // 5. Detect if repo has CI configured
  // Check for .github/workflows directory — if it exists the repo has CI
  // This is stored on the Repo model so the webhook handler can use it
  // without making extra API calls on every push event
  let hasCI = false;
  try {
    const workflowResponse = await fetch(
      `https://api.github.com/repos/${fullName}/contents/.github/workflows`,
      {
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (workflowResponse.ok) {
      const workflows = await workflowResponse.json();
      // Make sure the directory actually contains workflow files
      hasCI = Array.isArray(workflows) && workflows.length > 0;
    }
  } catch {
    // If the check fails for any reason, default to false
    // Better to show CODE_ERROR events than silently miss failures
    hasCI = false;
  }

  // 6. Save repo to DB with hasCI flag
  const repo = await prisma.repo.upsert({
    where: { githubId },
    update: {
      webhookId: webhook.id,
      hasCI,
    },
    create: {
      userId: session.user.id,
      githubId,
      name,
      fullName,
      private: isPrivate ?? false,
      webhookId: webhook.id,
      hasCI,
    },
  });

  return Response.json({ repo });
}