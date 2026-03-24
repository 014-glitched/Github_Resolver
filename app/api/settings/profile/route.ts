import { auth } from "@/src/lib/auth";
import prisma from "@/src/lib/prisma";
import { headers } from "next/headers";

export async function GET() {
    const session = await auth.api.getSession({ headers: await headers() })
    if(!session){
        return Response.json({ error: "Unauthorized "}, { status: 400 } )
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true,
            accounts: {
                where: { providerId: 'github' },
                select: {
                    accountId: true,
                    scope: true,
                    createdAt: true,
                }
            },
            repos: {
                select: {
                    id: true,
                    name: true,
                    fullName: true,
                    private: true,
                    webhookId: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    if(!user){
        return Response.json({ error: "User not found" }, { status: 404 })
    }

    return Response.json({ user })
}