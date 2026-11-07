-- Replace fixed 5-minute rounding with exact-minute rounding.
-- The previous formula inflated short waits (e.g. 2 min → 5 min).
-- The new formula returns the nearest whole minute (minimum 1).
CREATE OR REPLACE FUNCTION dorify.queue_estimate_minutes(people_ahead integer, cycle_minutes numeric, active_threads integer) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN people_ahead IS NULL OR active_threads <= 0 OR active_threads IS NULL OR cycle_minutes IS NULL THEN NULL
    WHEN people_ahead <= 0 OR cycle_minutes <= 0 THEN 0
    ELSE GREATEST(1, ROUND(people_ahead * cycle_minutes / active_threads))::int
  END
$$;
