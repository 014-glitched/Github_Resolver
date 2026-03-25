import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import { headers } from "next/headers";

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all repos to clean up webhooks
  const repos = await prisma.repo.findMany({
    where: { userId: session.user.id },
  });

  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      providerId: "github",
    },
  });

  // Delete all webhooks from GitHub
  if (account?.accessToken) {
    for (const repo of repos) {
      if (repo.webhookId) {
        try {
          await fetch(
            `https://api.github.com/repos/${repo.fullName}/hooks/${repo.webhookId}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${account.accessToken}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
              },
            }
          );
        } catch {
          // Continue
        }
      }
    }
  }

  // Delete user — cascades to sessions, accounts, repos, events
  await prisma.user.delete({
    where: { id: session.user.id },
  });

  return Response.json({ success: true });
}