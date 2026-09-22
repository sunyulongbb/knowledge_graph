export function parseJevScoreAnswer(answer: unknown): number | null {
  if (typeof answer === "number" && Number.isFinite(answer)) return answer;
  if (typeof answer === "string") {
    const parsed = Number(answer);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (!answer || typeof answer !== "object") return null;
  const value = answer as Record<string, unknown>;
  return parseJevScoreAnswer(value.score ?? value.value);
}

export function containsEntityReference(value: any, targetId: string): boolean {
  const normalizedTarget = String(targetId || "").replace(/^entity\//, "");
  if (!value || !normalizedTarget) return false;
  if (Array.isArray(value)) return value.some((item) => containsEntityReference(item, normalizedTarget));
  if (typeof value === "string") return value.replace(/^entity\//, "") === normalizedTarget;
  if (typeof value !== "object") return false;
  const candidate = value.id ?? value["entity-id"] ?? value.entity_id ?? value.target;
  if (candidate != null && String(candidate).replace(/^entity\//, "") === normalizedTarget) return true;
  return Object.values(value).some((item) => typeof item === "object" && containsEntityReference(item, normalizedTarget));
}
