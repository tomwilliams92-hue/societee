-- ============================================================================
--  Course reference data - must match app/lib/courses.ts exactly.
--  Generated from that file; regenerate rather than hand-editing.
--
--  `country` is load-bearing, not decorative: it decides which Playing Handicap
--  allowances an organiser may choose. England is fixed at 95% until 2028;
--  Wales, Scotland and Ireland allow 85-100% from 1 Apr 2026. Note Bromborough
--  and Wallasey are in the Wirral - English courses on a Welsh society's card.
--
--  Per-hole cards (the `holes` table) are NOT seeded - hole-by-hole scoring
--  stays switched off until a real scorecard is entered for a tee.
-- ============================================================================

insert into courses (id, name, club_name, county, country, holes) values
  ('conwy', 'Conwy', 'Conwy (Caernarvonshire) Golf Club', 'Conwy', 'Wales', 18),
  ('bromborough', 'Bromborough', 'Bromborough Golf Club', 'Wirral', 'England', 18),
  ('wallasey', 'Wallasey', 'Wallasey Golf Club', 'Wirral', 'England', 18),
  ('stmelyd', 'St Melyd', 'St Melyd Golf Club', 'Denbighshire', 'Wales', 18),
  ('abergele', 'Abergele', 'Abergele Golf Club', 'Conwy', 'Wales', 18)
on conflict (id) do update set
  name = excluded.name, club_name = excluded.club_name,
  county = excluded.county, country = excluded.country;

insert into tees (id, course_id, name, cr, slope, par) values
  ('conwy-blue', 'conwy', 'Blue', 74.5, 138, 72),
  ('conwy-white', 'conwy', 'White', 71.9, 121, 72),
  ('bromborough-white', 'bromborough', 'White', 72.9, 142, 72),
  ('wallasey-white', 'wallasey', 'White', 73.0, 133, 72),
  ('stmelyd-white', 'stmelyd', 'White', 68.4, 120, 69),
  ('abergele-white', 'abergele', 'White', 71.8, 124, 72)
on conflict (id) do update set
  cr = excluded.cr, slope = excluded.slope, par = excluded.par;
