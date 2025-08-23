// Keep hard data tiny; prefer loading tables from vendor later
const DC_BY_LEVEL: Record<number, number> = {
  0:14, 1:15, 2:16, 3:18, 4:19, 5:20, 6:22, 7:23, 8:24, 9:26, 10:27,
  11:28, 12:30, 13:31, 14:32, 15:34, 16:35, 17:36, 18:38, 19:39, 20:40,
  21:42, 22:44, 23:46, 24:48, 25:50
}; // Source: PF2e GM Core "Level-Based DCs" (same values as Core CRB)

export function levelDc(level: number): number {
  const clamp = Math.max(0, Math.min(25, Math.floor(level)));
  return DC_BY_LEVEL[clamp];
}

export type Degree = "critical_success" | "success" | "failure" | "critical_failure";

export function degreeOfSuccess(total: number, dc: number): Degree {
  if (total >= dc + 10) return "critical_success";
  if (total >= dc) return "success";
  if (total <= dc - 10) return "critical_failure";
  return "failure";
} // Degrees of success per PF2e rules