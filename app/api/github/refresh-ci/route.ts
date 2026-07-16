import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import { headers } from "next/headers";

/**
 * Refreshes the hasCI flag for a connected repository.
 *
 * This is needed when a user adds GitHub Actions to a repo
 * after it was already connected — the flag stored at connect
 * time would be stale (false) even though CI now exists.
 *
 * Flow:
 * 1. Validate session
 * 2. Find the repo in DB and verify ownership
 * 3. Check GitHub API for .github/workflows directory
 * 4. Update hasCI flag on the repo
 */
export async function POST(req: Request){
    // 1. Check session
    const session = await auth.api.getSession({ headers: await headers() })
    if(!session){
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Parse body
    const { repoId } = await req.json()
    if(!repoId){
        return Response.json({ error: "Mission repoId" }, { status: 400 })
    }

    // 3. Find repo and verify it belongs to this user
    const repo = await prisma.repo.findUnique({
        where: { id: repoId },
        select: { id: true, userId: true, fullName: true }
    })
    if(!repo){
        return Response.json({ error: "Respository not found" }, { status: 404 })
    }
    if(repo.userId !== session.user.id){
        return Response.json({ error: "Unauthorized" }, { status: 403 })
    }

    // 4. Get GitHub access token
    const account = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            providerId: "github",
        },
        select: { accessToken: true }
    })

    if(!account?.accessToken){
        return Response.json(
            { error: "GitHub account not connected" },
            { status: 400 },
        );
    }
    // 5. Check for .github/workflows directory on GitHub
    let hasCI = false
    try{
        const workflowResponse = await fetch(
            `https://api.github.com/repos/${repo.fullName}/contents/.github/workflows`,
            {
                headers: {
                    Authorization: `Bearer ${account.accessToken}`,
                    Accept: "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            },
        );
        if(workflowResponse.ok){
            const workflows = await workflowResponse.json()
            hasCI = Array.isArray(workflows) && workflows.length > 0
        }
    }catch{
        hasCI = false
    }

    // 6. Update hasCI flag in DB
    await prisma.repo.update({
        where: { id: repoId },
        data: { hasCI }
    })
    return Response.json({ hasCI })
}