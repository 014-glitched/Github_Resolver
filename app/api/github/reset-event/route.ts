import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import { headers } from "next/headers";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Reset event back to PENDING
  await prisma.githubEvent.update({
    where: { id: eventId },
    data: { status: "PENDING" },
  });

  // Reset job status if exists
  await prisma.resolveJob.updateMany({
    where: { eventId },
    data: { status: "CANCELLED" },
  });

  return Response.json({ success: true });
}