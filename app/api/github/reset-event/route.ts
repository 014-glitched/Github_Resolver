import { auth } from "@/src/lib/auth";
import { headers } from "next/headers";

// ISSUES-ONLY MODE: event-feed reset temporarily disabled
// import prisma from "@/src/lib/prisma";

export async function POST(_req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ISSUES-ONLY MODE: event cards / reset are temporarily disabled
  return Response.json(
    {
      error:
        "Event reset is temporarily disabled. Use the Issues page to resolve GitHub issues.",
    },
    { status: 410 },
  );

  /*
  const { eventId } = await req.json();

  const event = await prisma.githubEvent.findUnique({
    where: { id: eventId },
    select: { id: true, userId: true },
  });

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.userId !== session.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  await prisma.githubEvent.update({
    where: { id: eventId },
    data: { status: "PENDING" },
  });

  await prisma.resolveJob.updateMany({
    where: { eventId },
    data: { status: "CANCELLED" },
  });

  return Response.json({ success: true });
  */
}
