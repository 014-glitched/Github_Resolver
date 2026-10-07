import { createAuthClient } from "better-auth/react"

// Same-origin by default — works on localhost and Vercel without a hardcoded base URL
export const authClient = createAuthClient()

export const { signIn, signOut, useSession } = authClient
