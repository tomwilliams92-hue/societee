/* Societee — domain types. Mirrors supabase/schema.sql. */

export type SocietyRole = "owner" | "admin" | "scorer";
export type EventStatus = "draft" | "live" | "complete" | "cancelled";
export type ScoringFormat = "stableford" | "medal" | "par_bogey" | "gross";
export type RoundSource = "manual" | "live_scoring" | "whs_import" | "csv_import";

export type Tee = {
  id: string;
  courseId: string;
  name: string;
  /** Course Rating */
  cr: number;
  /** Slope Rating, 55–155 */
  slope: number;
  par: number;
};

/**
 * Which union's rules apply. Not cosmetic: from 1 Apr 2026 Wales, Scotland and
 * Ireland allow singles Playing Handicap allowances of 85–100%, while England
 * stays at a mandatory 95% until 2028. The course decides which applies.
 */
export type Union = "Wales" | "England" | "Scotland" | "Ireland";

export type Course = {
  id: string;
  name: string;
  clubName?: string;
  county?: string;
  country: Union;
  tees: Tee[];
};

export type Society = {
  id: string;
  slug: string;
  name: string;
  homeClub?: string;
  accent?: string;
  createdAt: string;
};

export type Player = {
  id: string;
  societyId: string;
  name: string;
  shortName?: string;
  /**
   * WHS handicap index. PLUS GOLFERS ARE NEGATIVE — Tom plays off +1.6, stored
   * as -1.6. Format with formatHandicap() for display; never store the string.
   */
  handicapIndex: number | null;
  active: boolean;
};

export type Season = {
  id: string;
  societyId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  /** best-N rounds count toward the Order of Merit; null = all of them */
  bestN: number | null;
  prize?: string;
  isCurrent: boolean;
};

export type GolfEvent = {
  id: string;
  societyId: string;
  seasonId?: string | null;
  courseId?: string;
  teeId?: string;
  name: string;
  playsOn: string;
  teeTime?: string;
  format: ScoringFormat;
  /** WHS allowance, %. 95 for individual Stableford. */
  handicapAllowance: number;
  status: EventStatus;
  shareToken: string;
  notes?: string;
};

export type EventEntry = {
  id: string;
  eventId: string;
  playerId: string;
  /** frozen at entry so a later index change can't rewrite history */
  playingHandicap: number | null;
  groupNo?: number;
  startHole?: number;
};

export type Round = {
  id: string;
  playerId: string;
  /** null for an ordinary club round — that's what makes Phase 3 possible */
  eventId: string | null;
  courseId?: string;
  teeId?: string;
  playedOn: string;
  format: ScoringFormat;
  gross: number | null;
  adjustedGross: number | null;
  courseHandicap: number | null;
  stableford: number | null;
  net: number | null;
  source: RoundSource;
  verified: boolean;
};

export type SideComp = {
  id: string;
  eventId: string;
  kind: "ntp" | "longest_drive" | string;
  hole?: number;
  winnerId?: string | null;
  detail?: string;
};

/** A row on the board. Derived, never stored. */
export type Standing = {
  player: Player;
  playingHandicap: number | null;
  stableford: number | null;
  gross: number | null;
  net: number | null;
  holesIn: number;
  position: number;
  tied: boolean;
};
