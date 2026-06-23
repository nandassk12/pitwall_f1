-- ============================================================
-- F1 PITWALL — SUPABASE SCHEMA
-- Field names match existing API responses 1:1 (see field_inventory.md)
-- so the backend can swap "compute live from FastF1" for
-- "read from Supabase" without touching any frontend component.
-- ============================================================


-- ============================================================
-- 1. EVENTS  (one row per Grand Prix weekend)
-- Backs: /api/sessions/calendar
-- Source: FastF1 EventSchedule (EventName, RoundNumber, EventDate, Country, Location)
-- ============================================================
create table events (
    id              bigint generated always as identity primary key,
    year            int not null,
    round           int not null,
    name            text not null,           -- FastF1 EventName, used as session-load identifier
    "shortName"     text not null,            -- short circuit name shown in dropdowns/cards
    country         text not null,
    date            date not null,
    "dateRange"     text,                     -- pre-formatted "Jun 26 - Jun 28" string
    created_at      timestamptz not null default now(),

    unique (year, round)
);

create index idx_events_year on events (year);


-- ============================================================
-- 2. EVENT_SESSIONS  (Practice 1/2/3, Qualifying, Race — schedule only)
-- Backs: /api/sessions/calendar -> sessions[] sub-array
-- Source: FastF1 Session1..Session5 / Session1Date..Session5Date
-- ============================================================
create table event_sessions (
    id              bigint generated always as identity primary key,
    event_id        bigint not null references events (id) on delete cascade,
    name            text not null,            -- "Practice 1", "Qualifying", "Race", etc.
    time            timestamptz not null,
    created_at      timestamptz not null default now()
);

create index idx_event_sessions_event on event_sessions (event_id);


-- ============================================================
-- 3. SESSIONS  (the actual loaded/cached session — cache key table)
-- Backs: /api/status, /api/sessions/load, /api/sessions/types
-- This is the row that answers "do I already have this cached?"
-- ============================================================
create table sessions (
    id              bigint generated always as identity primary key,
    event_id        bigint not null references events (id) on delete cascade,
    year            int not null,
    round           int not null,
    "sessionType"   text not null,            -- "FP1" | "FP2" | "FP3" | "Q" | "R"
    label           text not null,            -- e.g. "Japanese Grand Prix - Race"
    source          text not null,            -- "fastf1" | "openf1"
    "totalDrivers"  int,
    "totalLaps"     int,
    cached_at       timestamptz not null default now(),

    unique (year, round, "sessionType")
);

create index idx_sessions_lookup on sessions (year, round, "sessionType");


-- ============================================================
-- 4. DRIVERS  (reference table, upserted as seen — not per-session)
-- Backs: /api/drivers (static fields), /api/team-colors
-- Source: FastF1 results (Abbreviation, DriverNumber, FullName, TeamName)
-- ============================================================
create table drivers (
    id              bigint generated always as identity primary key,
    name            text not null unique,     -- 3-letter abbreviation, e.g. "VER"
    "fullName"      text not null,
    no              int,                       -- car number
    team            text not null,
    "teamColor"     text not null,             -- hex string, e.g. "#1E41FF"
    created_at      timestamptz not null default now()
);


-- ============================================================
-- 5. RESULTS  (final classification per session)
-- Backs: /api/drivers (per-session standings/timing tower)
-- Source: FastF1 session.results
-- ============================================================
create table results (
    id              bigint generated always as identity primary key,
    session_id      bigint not null references sessions (id) on delete cascade,
    pos             int,
    no              int,
    name            text not null,             -- driver abbreviation
    "fullName"      text,
    team            text not null,
    "pointsScored"  numeric,
    "seasonPoints"  numeric,
    gap             text,                      -- pre-formatted "+4.512s" | "LEADER" | "DNF" | "+1 LAP"
    "gridPosition"  int,
    status          text,                      -- "Finished" | "DNF" | "DSQ" etc.
    "hasTelemetry"  boolean not null default true,

    unique (session_id, name)
);

create index idx_results_session on results (session_id);


-- ============================================================
-- 6. LAPS  (one row per driver per lap — backs most analysis tabs)
-- Backs: /api/panels/sector-analysis, /api/panels/lap-times,
--        pace-candle box plot, pit strategy stint derivation
-- Source: FastF1 session.laps
-- ============================================================
create table laps (
    id              bigint generated always as identity primary key,
    session_id      bigint not null references sessions (id) on delete cascade,
    driver          text not null,             -- abbreviation, matches drivers.name
    lap             int not null,              -- LapNumber
    "lapTime"       numeric,                   -- seconds (converted from Timedelta)
    s1              numeric,                   -- Sector1Time, seconds
    s2              numeric,                   -- Sector2Time, seconds
    s3              numeric,                   -- Sector3Time, seconds
    "s1Flag"        text,                      -- "session_best" | "personal_best" | "normal" | "none"
    "s2Flag"        text,
    "s3Flag"        text,
    compound        text,                      -- "SOFT" | "MEDIUM" | "HARD" | etc.
    "tyreAge"       int,                       -- TyreLife
    position        int,
    "pitIn"         boolean not null default false,
    "pitOut"        boolean not null default false,
    "pitStop"       boolean not null default false,
    "trackStatus"   text,                      -- raw FastF1 TrackStatus, used to filter clean laps
    "isAccurate"    boolean,                   -- FastF1 IsAccurate flag, used to filter clean laps

    unique (session_id, driver, lap)
);

create index idx_laps_session_driver on laps (session_id, driver);
create index idx_laps_session on laps (session_id);


-- ============================================================
-- 7. TELEMETRY  (one row per driver per lap, channels stored as arrays)
-- Backs: /api/chart/speed, /api/chart/throttle, /api/chart/rpm-vs-speed,
--        /api/chart/gforce, circuit position dots, track dominance
-- Source: FastF1 lap.get_telemetry()
-- Stored as arrays, NOT one row per sample — keeps Supabase storage small.
-- ============================================================
create table telemetry (
    id              bigint generated always as identity primary key,
    session_id      bigint not null references sessions (id) on delete cascade,
    driver          text not null,
    lap             int not null,

    time            numeric[] not null,        -- seconds, aligned index across all arrays below
    speed           numeric[] not null,        -- km/h
    throttle        numeric[] not null,        -- 0-100
    brake           numeric[] not null,        -- 0 or 100
    rpm             numeric[] not null,
    gear            int[] not null,
    "drs"           int[],
    x               numeric[] not null,        -- normalized [0,1]
    y               numeric[] not null,        -- normalized [0,1]
    "latG"          numeric[],                 -- computed at ingestion from position/speed
    "longG"         numeric[],                 -- computed at ingestion from position/speed

    unique (session_id, driver, lap)
);

create index idx_telemetry_session_driver on telemetry (session_id, driver);


-- ============================================================
-- 8. RACE_CONTROL_MESSAGES
-- Backs: /api/race-control
-- Source: FastF1 session.race_control_messages
-- ============================================================
create table race_control_messages (
    id              bigint generated always as identity primary key,
    session_id      bigint not null references sessions (id) on delete cascade,
    lap             int,
    date            timestamptz not null,
    flag            text,
    "flagColor"     text,
    badge           text,
    category        text,
    message         text not null,
    "driverNumber"  int,
    sector          int,

    created_at      timestamptz not null default now()
);

create index idx_race_control_session on race_control_messages (session_id);


-- ============================================================
-- 9. PIT_STOPS  (derived stint summary, precomputed at ingestion
--    so /api/panels/pit-strategy doesn't recompute on every request)
-- Backs: /api/panels/pit-strategy
-- Derived from: laps table (compound + pit flags), grouped into stints
-- ============================================================
create table pit_stints (
    id              bigint generated always as identity primary key,
    session_id      bigint not null references sessions (id) on delete cascade,
    driver          text not null,
    team            text not null,
    "teamColor"     text not null,
    compound        text not null,
    "startLap"      int not null,
    "endLap"        int not null,
    "lapCount"      int not null,
    stint_order     int not null               -- 1st stint, 2nd stint, etc.
);

create index idx_pit_stints_session on pit_stints (session_id);


-- ============================================================
-- 10. WEATHER  (one row per session)
-- Backs: /api/weather
-- Source: FastF1 session.weather_data
-- ============================================================
create table weather (
    id              bigint generated always as identity primary key,
    session_id      bigint not null unique references sessions (id) on delete cascade,
    "trackTemp"     numeric,
    "airTemp"       numeric,
    "rainRiskPercent" numeric
);


-- ============================================================
-- 11. CHAMPIONSHIP_STANDINGS  (derived, cumulative per round)
-- Backs: /api/panels/championship, /api/panels/driver-results
-- Derived from: results table, summed per round, NOT a separate
-- external source (we dropped F1DB for this — see earlier discussion)
-- ============================================================
create table championship_standings (
    id              bigint generated always as identity primary key,
    year            int not null,
    round           int not null,
    type            text not null,             -- "driver" | "constructor"
    code            text not null,              -- driver abbreviation or team name
    pos             int not null,
    points          numeric not null,
    wins            int not null default 0,
    podiums         int not null default 0,
    "pointFinishes" int not null default 0,
    dnfs            int not null default 0,

    unique (year, round, type, code)
);

create index idx_standings_lookup on championship_standings (year, type, round);
