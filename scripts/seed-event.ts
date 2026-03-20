import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user found");

  const repo = await prisma.repo.findFirst({
    where: { userId: user.id },
  });
  if (!repo) throw new Error("No repo found");

  const [owner, repoName] = repo.fullName.split("/");

  // Fetch open PRs from the repo
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/pulls?state=open&per_page=5`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  const prs = await response.json();
  console.log(`Found ${prs.length} open PRs`);

  if (!prs.length) throw new Error("No open PRs found");

  const pr = prs[0];
  console.log(`Using PR #${pr.number}: ${pr.title}`);
  console.log(`Head SHA: ${pr.head.sha}`);

  // Delete old test events
  await prisma.githubEvent.deleteMany({
    where: {
      userId: user.id,
      title: { contains: "CI Failed: test" },
    },
  });

  // Create event with real PR payload
  const event = await prisma.githubEvent.create({
    data: {
      userId: user.id,
      repoId: repo.id,
      type: "CI_FAILURE",
      title: `CI Failed: PR #${pr.number} — ${pr.title}`,
      description: `CI failure on PR #${pr.number} in ${repo.fullName}`,
      status: "PENDING",
      payload: {
        check_run: {
          name: "CI",
          conclusion: "failure",
          head_sha: pr.head.sha,
          output: {
            summary: "Tests failed due to bugs in detector.py",
            text: "TypeError: Cannot read properties of undefined\nKeyError: label",
          },
          html_url: `https://github.com/${repo.fullName}/runs/123`,
        },
        repository: {
          id: repo.githubId,
          full_name: repo.fullName,
        },
      },
    },
  });

  console.log("Created event:", event.id);
  console.log("PR head SHA:", pr.head.sha);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());s