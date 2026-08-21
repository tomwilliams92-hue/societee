/* Societee — domain types. Mirrors supabase/schema.sql. */

export type SocietyRole = "owner" | "admin" | "scorer";
export type EventStatus = "draft" | "live" | "complete" | "cancelled";
export type ScoringFormat = "stableford" | "medal" | "par_bogey" | "gross";
export type RoundSource = "manual" | "live_scoring" | "whs_import" | "csv_import";

/** One hole on a real, published scorecard. */
export type HoleInfo = {
  hole: number;
  par: number;
  /** Stroke index 1–18. Decides who gets a shot where — wrong SI, wrong points. */
  strokeIndex: number;
  yards?: number;
};

export type Tee = {
  id: string;
  courseId: string;
  name: string;
  /** Course Rating */
  cr: number;
  /** Slope Rating, 55–155 */
  slope: number;
  par: number;
  /**
   * The real card. ABSENT until someone enters verified data for this tee.
   * Hole-by-hole scoring is switched off without it — a guessed stroke index
   * produces confidently wrong Stableford points, which is worse than no
   * feature at all. Entering a gross total never needs this.
   */
  card?: HoleInfo[];
};

/** A fourball (or three, or two). One phone in the group does the scoring. */
export type EventGroup = {
  id: string;
  eventId: string;
  groupNo: number;
  /** Which hole this group teed off from — two-tee starts are per group. */
  startHole: number;
  /** Secret in the group's scoring link. No account, but not guessable. */
  scorerToken: string;
};

export type HoleScore = {
  roundId: string;
  hole: number;
  strokes: number | null;
  points: number | null;
};

/**
 * Which union's rules apply. Not cosmetic: from 1 Apr 2026 Wales, Scotland and
 * Ireland allow singles Playing Handicap allowances of 85–100%, while England
 * stays at a mandatory 95% until 2028. The course decides which applies.
 */
export type Union = "Wales" | "England" | "Scotland" | "Ireland" | "Portugal";

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
  /** id of a built-in badge from the art pack, e.g. "flag-green" */
  badge?: string;
  /** an uploaded image (data URL) — wins over `badge` when set */
  crestData?: string;
  createdAt: string;
};

export type Player = {
  id: string;
  societyId: string;
  name: string;
  shortName?: string;
  /**
   * WHS handicap index. PLUS GOLFERS ARE NEGATIVE — Tom plays off +1.3, stored
   * as -1.3. Format with formatHandicap() for display; never store the string.
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

/**
 * A trip or multi-round competition: several golf days whose points add up on
 * one combined board (R1 · R2 · R3, like any tour event). Each day stays an
 * ordinary event — same scoring links, same board — the series just sums them.
 */
export type Series = {
  id: string;
  societyId: string;
  name: string;
};

export type GolfEvent = {
  id: string;
  societyId: string;
  seasonId?: string | null;
  /** set when this day is one round of a Series */
  seriesId?: string | null;
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
  /** players may add themselves via the event's registration link */
  selfRegister?: boolean;
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
