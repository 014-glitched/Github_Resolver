import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import { headers } from "next/headers";

export async function POST(req: Request){
    // 1. Check session
    const session = await auth.api.getSession({ headers: await headers() })

    if(!session){
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
    // 2. Parse body
    const body = await req.json()
    const { githubId } = body
    
    if(!githubId){
        return Response.json({ error: "Missing githubId" }, { status: 400 })
    }
    
    // 3. Get GitHub access token to delete the webhook
    const account = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            providerId: "github",
        }
    })
    if(!account?.accessToken){
        return Response.json(
            { error: "Github account not connected" },
            { status: 400 }
        )
    }
    // 4. Find repo in DB — needed for fullName and webhookId
    const repo = await prisma.repo.findUnique({
        where: { githubId }
    })
    if(!repo){
        return Response.json({ error: "Repository not found" }, { status: 404 })
    }
    // 5. Delete webhook from GitHub so it stops sending events
    // If webhookId is missing we skip this step — repo may have been
    // manually disconnected from GitHub already
    if (repo.webhookId) {
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
    }
    // 6. Delete from DB
    await prisma.repo.delete({
        where: { githubId }
    })
    return Response.json({ message: "Repository disconnected successfully" })
}