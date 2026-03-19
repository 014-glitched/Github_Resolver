import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import { headers } from "next/headers";

export async function POST(req: Request){
    // 1. Check session
    const session = await auth.api.getSession({ headers: await headers() })

    if(!session){
        return Response.json({ error: "Unauthorized"}, { status: 401 })
    }
    // 2. Parse request body
    const body = await req.json()
    // console.log("Request body", body)
    const { githubId, name, fullName, isPrivate } = body

    if(!githubId || !name || !fullName){
        return Response.json({ error: "Missing required fields"}, { status: 400 })
    }
    // 3. Get GitHub access token
    const account = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            providerId: "github"
        }
    })
    if(!account?.accessToken){
        return Response.json(
            { error: "Github account not connected" },
            { status: 400}
        )
    }
    // 4. Register webhook on GitHub
    const webhookUrl = `${process.env.BETTER_AUTH_URL}/api/github/webhook`

    const webhookResponse = await fetch(
        `https://api.github.com/repos/${fullName}/hooks`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${account.accessToken}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: "web",
                active: true,
                events: ["pull_request", "check_run", "check_suite", "push"],
                config: {
                    url: webhookUrl,
                    content_type: "json",
                    insecure_ssl: "0",
                    secret: process.env.GITHUB_WEBHOOK_SECRET
                },
            }),  
        }
    )

    if(!webhookResponse.ok){
        const error = await webhookResponse.json()
        return Response.json(
            { error: "Failed to register webhook on Github", details: error },
            { status: 400 }
        )
    }

    const webhook = await webhookResponse.json()
    // 5. Save repo to DB
    const repo = await prisma.repo.upsert({
        where: { githubId },
        update: {
            webhookId: webhook.id,
        },
        create: {
            userId: session.user.id,
            githubId,
            name,
            fullName,
            private: isPrivate ?? false,
            webhookId: webhook.id,
        }
    })

    return Response.json({ repo });
}