import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma"; // import the singleton we already set up

function buildTrustedOrigins(): string[] {
  const origins = new Set<string>([
    "http://localhost:3000",
    "http://localhost:3001",
    "https://github-resolver-git-main-devs-code.vercel.app",
  ]);

  const authUrl = process.env.BETTER_AUTH_URL?.trim();
  if (authUrl) {
    try {
      origins.add(new URL(authUrl).origin);
    } catch {
      // ignore malformed BETTER_AUTH_URL
    }
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const host = vercelUrl.replace(/^https?:\/\//, "");
    origins.add(`https://${host}`);
  }

  return [...origins];
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      scope: [
        "read:user",
        "user:email",
        "repo",
        "write:repo_hook",
      ],
    },
  },
  trustedOrigins: buildTrustedOrigins(),
});
