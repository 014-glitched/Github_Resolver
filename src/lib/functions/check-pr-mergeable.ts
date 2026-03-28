import { inngest } from "@/src/inngest/client"
import prisma from "../prisma"
import { Octokit } from "octokit"

const MAX_ATTEMPTS = 3

// Backoff base delays in milliseconds
const BACKOFF_DELAYS = [10000, 25000, 45000]

// Jitter caps per attempt in milliseconds
const JITTER_CAPS = [5000, 8000, 10000]

function getDelayWithJitter(attempt: number): number {
    const base = BACKOFF_DELAYS[attempt] ?? 45000
    const jitterCap = JITTER_CAPS[attempt] ?? 10000
    const jitter = Math.floor(Math.random() * jitterCap)
    return base + jitter
}

// Convert ms to a string Inngest understands e.g. "12500ms"
function msToInngestDelay(ms: number): string {
    return `${ms}ms`
}

export const checkPrMergeable = inngest.createFunction(
    {
        id: "check-pr-mergeable",
        name: "Check PR Mergeable Status",
        retries: 0
    },
    { event: "github/pr.check-mergeable" },
    async ({ event, step }) => {
        const {
            repoId,
            userId,
            prNumber,
            repoFullName,
            sourceBranch,
            prTitle,
        } = event.data

        let mergeable: boolean | null = null

        // ── Retry loop with backoff + jitter
        for(let attempt = 0; attempt < MAX_ATTEMPTS; attempt++){
            const delay = getDelayWithJitter(attempt)

            await step.sleep(
                `wait-attempt-${attempt}`,
                msToInngestDelay(delay),
            );

            mergeable = await step.run(
                `fetch-mergeable-attempt-${attempt}`,
                async () => {
                    const account = await prisma.account.findFirst({
                        where: { userId, providerId: "github" },
                        select: { accessToken: true }
                    });

                    if(!account?.accessToken){
                        throw new Error("No GitHub access token found")
                    }

                    const octokit = new Octokit({ auth: account.accessToken })
                    const [owner, repoName] = repoFullName.split("/")

                    const { data: pr } = await octokit.rest.pulls.get({
                        owner,
                        repo: repoName,
                        pull_number: prNumber,
                    })
                    return pr.mergeable
                }
            );
            // GitHub has given a definitive answer — stop polling
            if(mergeable !== null){
                break;
            }
            console.log(
                `[check-pr-mergeable] Attempt ${attempt + 1}: mergeable still null for PR #${prNumber}, retrying...`,
            );
        }
        // After all attempts, still null — GitHub never resolved it, give up
        if(mergeable === null){
            console.warn(
                `[check-pr-mergeable] PR #${prNumber} mergeable status never resolved after ${MAX_ATTEMPTS} attempts — skipping`,
            );
            return {
                skipped: true,
                reason: "mergeable status never resolved after max attempts",
            }
        }
        // PR is mergeable — no conflict, nothing to do
        if(mergeable === true){
            return { skipped: true, reason: "PR is mergeable" };
        }
        // mergeable === false — real conflict confirmed
        await step.run("create-conflict-event", async () => {
            // Already tracking an active conflict for this branch — skip
            const existing = await prisma.githubEvent.findFirst({
                where: {
                    repoId,
                    type: "PR_CONFLICT",
                    status: { in: ["PENDING", "RESOLVING"] },
                    sourceBranch
                }
            })
            if(existing) return

            // Resolved event exists for this branch — reset to PENDING
            const resolved = await prisma.githubEvent.findFirst({
                where: {
                    repoId,
                    type: "PR_CONFLICT",
                    status: "RESOLVED",
                    sourceBranch
                },
                include: { resolveJob: true },
                orderBy: { createdAt: "desc" }
            })

            if(resolved){
                await prisma.githubEvent.update({
                    where: { id: resolved.id },
                    data: {
                        status: "PENDING",
                        title: `Merge Conflict: ${prTitle}`,
                        description: `PR #${prNumber} has a merge conflict in ${repoFullName}`,
                        updatedAt: new Date(),
                    }
                })

                if(resolved.resolveJob){
                    await prisma.resolveJob.update({
                        where: { eventId: resolved.id },
                        data: {
                            status: "QUEUED",
                            prUrl: null,
                            prNumber: null,
                            errorMsg: null,
                            startedAt: null,
                            completedAt: null,
                        }
                    })
                }
                return
            }
            // No existing event — create fresh
            await prisma.githubEvent.create({
                data: {
                    userId,
                    repoId,
                    type: "PR_CONFLICT",
                    title: `Merge Conflict: ${prTitle}`,
                    description: `PR #${prNumber} has a merge conflict in ${repoFullName}`,
                    sourceBranch,
                    payload: {},
                    status: "PENDING",
                }
            })
        })

        return { success: true, prNumber}
    }
)