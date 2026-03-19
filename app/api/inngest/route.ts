import { inngest } from '@/src/inngest/client'
import { resolveGithubEvent } from '@/src/lib/functions/resolve-event'
import { serve } from 'inngest/next'

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [resolveGithubEvent],
})