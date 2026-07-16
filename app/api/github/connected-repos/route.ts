import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import { headers } from "next/headers";

/**
 * GET /api/github/connected-repos
 *
 * Returns only the repos the user has connected in our app,
 * using our internal DB cuid as the id — not the GitHub numeric id.
 *
 * This is different from /api/github/repos which returns ALL of the
 * user's GitHub repos (connected or not) using GitHub's numeric id.
 * That route is used on the Repositories page for the connect/disconnect flow.
 *
 * This route is used by the Issues page which needs:
 * - Only connected repos (no point showing repos with no webhook)
 * - Internal DB id (cuid) to pass to /api/github/issues?repoId=xxx
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repos = await prisma.repo.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,       // internal cuid — what the issues page needs
      name: true,
      fullName: true,
      private: true,
      hasCI: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ repos });
}