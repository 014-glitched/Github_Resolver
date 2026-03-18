Wire webhook → trigger Inngest job
⬜ Build AI resolver (Claude API integration)
     → Step 1: Fetch code context from GitHub
     → Step 2: Send to Claude + get patch
     → Step 3: Validate patch
⬜ Auto PR creation
     → Create branch
     → Commit patch
     → Open PR
⬜ Dashboard error feed
     → Show GitHub events in real time
     → Expanded cards with issue details
     → Resolve button per card
⬜ Inline job progress on card
     → Poll job status with TanStack Query
     → Show live steps (fetching → analyzing → patching → PR)
⬜ Activity log page
⬜ Settings page
⬜ Deployment (Vercel + production env vars)

1. Wire webhook → Inngest        ← next right now
2. Dashboard error feed          ← show events live
3. Resolve button → trigger job
4. AI resolver steps
5. Auto PR creation
6. Polish (activity log, settings, deployment)