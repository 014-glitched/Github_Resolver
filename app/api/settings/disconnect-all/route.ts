import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import { success } from "better-auth";
import { headers } from "next/headers";

export async function POST(){
    const session = await auth.api.getSession({ headers: await headers() })
    if(!session){
        return Response.json({ error: "Unauthorized" }, { status: 400 })
    }

    // Get all connected repos
    const repos = await prisma.repo.findMany({
        where: { userId: session.user.id },
    })
    // Get access token
    const account = await prisma.account.findFirst({
        where: { 
            userId: session.user.id,
            providerId:  'github'
        }
    })
    // Delete webhooks from GitHub
    if(account?.accessToken){
        for(const repo of repos){
            if(repo.webhookId){
                try{
                    await fetch(
                        `https://api.github.com/repos/${repo.fullName}/hooks/${repo.webhookId}`,
                        {
                            method: "DELETE",
                            headers: {
                                Authorization: `Bearer ${account.accessToken}`,
                                Accept: "application/vnd.github+json",
                                "X-GitHub-Api-Version": "2022-11-28",
                            }
                        }
                    )
                }catch{

                }
            }
        }
    }
    // Delete all repos from DB
    await prisma.repo.deleteMany({
        where: { userId: session.user.id }
    })
    
    return Response.json({ success: true })
}