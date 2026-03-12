export const DESKS = ['A', 'B', 'D', 'C'] as const;
export type Desk = (typeof DESKS)[number];

/**
 * Assigns a desk based on the team's index in the shortlist.
 * This is used to distribute teams evenly across check-in stations.
 */
export function assignDesk(teamIndex: number): Desk {
  return DESKS[teamIndex % 4];
}
