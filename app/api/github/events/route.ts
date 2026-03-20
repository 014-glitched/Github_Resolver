import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import { headers } from "next/headers";

export async function GET(){
    const session = await auth.api.getSession({ headers: await headers() })

    if(!session){
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const events = await prisma.githubEvent.findMany({
        where: { userId: session.user.id },
        include: {
            repo: {
                select: {
                    name: true,
                    fullName: true
                }
            },
            resolveJob: {
                select: {
                    id: true,
                    status: true,
                    prUrl: true,
                    prNumber: true,
                    errorMsg: true,
                }
            }
        },
        orderBy: { createdAt: "desc" },
        take: 50
    })

    return Response.json({ events })
}