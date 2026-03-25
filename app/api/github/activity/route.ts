import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import { headers } from "next/headers";

export async function GET(req: Request){
    const session = await auth.api.getSession({ headers: await headers() })
    if(!session){
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") ?? "ALL"
    const search = searchParams.get("search") ?? ""
    const page = parseInt(searchParams.get("page") ?? "1")
    const limit = 10
    const skip = (page - 1) * limit

    // Filter
    const where: any = {
        userId: session.user.id,
        ...(status != "ALL" && { status }),
        ...(search && {
            OR: [
                { title: { contains: search, mode: "insensitive "}},
                { repo: { fullName: { contains: search, mode: "insensitive" }}}
            ]
        })
    }
    // Fetch events + total count in parallel
    const [events, total] = await Promise.all([
        prisma.githubEvent.findMany({
            where,
            include: {
                repo: {
                    select: { name: true, fullName: true }
                },
                resolveJob: {
                    select: {
                        id: true,
                        status: true,
                        prUrl: true,
                        prNumber: true,
                        errorMsg: true,
                        startedAt: true,
                        completedAt: true,
                    }
                }
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit
        }),
        prisma.githubEvent.count({ where })
    ])

    // Stats
    const[totalResolved, totalFailed, allRepos] = await Promise.all([
        prisma.githubEvent.count({
            where: { userId: session.user.id, status: "RESOLVED" }
        }),
        prisma.githubEvent.count({
            where: { userId: session.user.id, status: "FAILED" }
        }),
        prisma.githubEvent.groupBy({
            by: ["repoId"],
            where: { userId: session.user.id },
            _count: { repoId: true },
            orderBy: { _count: 
                { repoId: "desc" }
            },
            take: 1,
        })
    ])

    // Get most active repo name
    const mostActiveRepo = allRepos.length > 0 
        ?   await prisma.repo.findUnique({
                where: { id: allRepos[0].repoId },
                select: { name: true }
            }).then((r) => r?.name ?? null) 
        : null

    const totalEvents = await prisma.githubEvent.count({
        where: { userId: session.user.id }
    })
    return Response.json({
        events,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
        },
        stats: {
            total: totalEvents,
            resolved: totalResolved,
            failed: totalFailed,
            successRate:
                totalEvents > 0
                ? Math.round((totalResolved / totalEvents) * 100)
                : 0,
            mostActiveRepo,
        },
    })
}