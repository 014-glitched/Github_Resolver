import { auth } from "@/src/lib/auth";
import { headers } from "next/headers";

// ISSUES-ONLY MODE: event-feed resolve temporarily disabled
// import { inngest } from "@/src/inngest/client";
// import prisma from "@/src/lib/prisma";

export async function POST(_req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ISSUES-ONLY MODE: use POST /api/github/issues/resolve instead
  return Response.json(
    {
      error:
        "Event resolve is temporarily disabled. Use the Issues page to resolve GitHub issues.",
    },
    { status: 410 },
  );

  /*
  const { eventId, strategy, customBranch } = await req.json();

  if (!eventId) {
    return Response.json({ error: "Missing eventId" }, { status: 400 });
  }

  const event = await prisma.githubEvent.findUnique({
    where: { id: eventId },
    select: { id: true, userId: true, status: true },
  });

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }
  if (event.userId !== session.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (event.status === "RESOLVED") {
    return Response.json({ error: "Event already resolved" }, { status: 400 });
  }
  if (event.status === "RESOLVING") {
    return Response.json(
      { error: "Event is already being resolved" },
      { status: 400 },
    );
  }

  const job = await prisma.resolveJob.upsert({
    where: { eventId },
    update: { status: "QUEUED", errorMsg: null },
    create: {
      eventId,
      status: "QUEUED",
    },
  });

  try {
    await inngest.send({
      name: "github/event.resolve",
      data: {
        eventId,
        userId: session.user.id,
        strategy: strategy ?? "new",
        customBranch,
      },
    });
  } catch (err: any) {
    console.error("[resolve] Inngest send failed:", err?.message);
    return Response.json(
      { error: "Failed to queue job", details: err?.message },
      { status: 500 },
    );
  }

  return Response.json({ job });
  */
}
