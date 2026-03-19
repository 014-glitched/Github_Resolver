import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import { headers } from "next/headers";

export async function GET(){
    // 1. Check session
    const session = await auth.api.getSession({ headers: await headers() })
    // console.log("session", session)

    if(!session){
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
    // 2. Get GitHub access token from Account table
    const account = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            providerId: "github",
        },
    })
    // console.log("Account", account)

    if(!account?.accessToken){
        return Response.json(
            { error: "Github account not connected" },
            { status: 400 }
        )
    }
     // 3. Fetch repos from GitHub API
    const response = await fetch(
        "https://api.github.com/user/repos?per_page=100&sort=updated&type=all",
        {
        headers: {
            Authorization: `Bearer ${account.accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        }
    );
    // console.log("response:--", response)

    if(!response.ok){
        return Response.json(
            { error: "Failed to fetch repositories from Github" },
            { status: response.status }
        )
    }
    const repos = await response.json()

    // 4. Get already connected repos from our DB
    const connectedRepos = await prisma.repo.findMany({
        where: { userId: session.user.id },
        select: { githubId: true }
    })

    const connectedIds = new Set(connectedRepos.map((repo) => repo.githubId))

    // 5. Return cleaned up repo list with connected status
    const data = repos.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        description: repo.description,
        language: repo.language,
        updatedAt: repo.updated_at,
        connected: connectedIds.has(repo.id),
    }))
    return Response.json({ repos: data })
}