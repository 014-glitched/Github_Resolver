import { z } from "zod";

export const prOutcomeStateSchema = z.enum([
  "OPEN",
  "MERGED",
  "CLOSED_UNMERGED",
  "CHANGES_REQUESTED",
]);

export type PrOutcomeStateValue = z.infer<typeof prOutcomeStateSchema>;

export const prOutcomeViewSchema = z.object({
  state: prOutcomeStateSchema,
  prNumber: z.number().int().positive(),
  prUrl: z.string().min(1),
  openedAt: z.string().nullable(),
  mergedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  changesRequestedAt: z.string().nullable(),
  lastObservedAt: z.string(),
  githubUpdatedAt: z.string().nullable(),
});

export type PrOutcomeView = z.infer<typeof prOutcomeViewSchema>;
