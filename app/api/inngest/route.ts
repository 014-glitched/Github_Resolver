import { inngest } from '@/src/inngest/client'
// ISSUES-ONLY MODE: event-feed resolvers temporarily disabled
// import { checkPrMergeable } from '@/src/lib/functions/check-pr-mergeable'
// import { resolveGithubEvent } from '@/src/lib/functions/resolve-event'
import { resolveGithubIssue } from '@/src/lib/functions/resolve-github-issue'
import { serve } from 'inngest/next'

export const { GET, POST, PUT } = serve({
    client: inngest,
    // ISSUES-ONLY MODE: only GitHub Issue resolution is registered
    functions: [resolveGithubIssue],
    // functions: [resolveGithubEvent, checkPrMergeable, resolveGithubIssue],
})
