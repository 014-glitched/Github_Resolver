import { z } from "zod";

export const triageResultSchema = z.object({
  confidence: z.number().int().min(0).max(100),
  effort: z.enum(["S", "M", "L"]),
  risk: z.enum(["low", "medium", "high"]),
  reason: z.string().trim().min(1).max(280),
});

export type TriageResult = z.infer<typeof triageResultSchema>;

export function parseTriageModelOutput(raw: string): TriageResult {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Triage model returned no JSON object");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("Triage model returned invalid JSON");
  }
  return triageResultSchema.parse(parsed);
}
