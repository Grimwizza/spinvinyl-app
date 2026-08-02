-- Last.fm scrobble-connection state — one row per (SpinVinyl username).
-- Stores the permanent Last.fm session key server-side only; never exposed
-- to the client. This Supabase project is a shared "LowHigh.ai parent
-- database" used by multiple sites, so the sv_ prefix is required.
--
-- Run this once by hand in the Supabase SQL editor (this repo has no
-- migration tooling — see supabase/schema_collection_archive.sql for the
-- sibling table this mirrors the reasoning/style of).

create table if not exists sv_lastfm_connections (
    username        text primary key,     -- Discogs username, from the session cookie
    session_key     text not null,        -- permanent Last.fm session key (server-side only)
    lastfm_username text,                 -- for display in the UI
    connected_at    timestamptz not null default now()
);

alter table sv_lastfm_connections enable row level security;
-- No policies added intentionally — only the service-role key (server-side,
-- api/lastfm.js) can touch this table, same pattern as sv_collection_archive.

-- IMPORTANT (learned the hard way earlier this session): after running this,
-- also run, once, for the service-role key to actually be able to use it:
--   grant select, insert, update, delete on table public.sv_lastfm_connections to service_role;
-- On a fresh Supabase project this is usually automatic, but this shared
-- project needed it granted explicitly for sv_collection_archive too.
