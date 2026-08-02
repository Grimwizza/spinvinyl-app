-- Personal collection archive — one row per (username, instance_id).
-- Strictly per-user: each user's own collection, stored to be served back
-- to that same user only. Never a shared/cross-user catalog.
--
-- Run this once by hand in the Supabase SQL editor (this repo has no
-- migration tooling — see api/sync.js for the sibling sv_user_stats table,
-- which was presumably created the same way).

create table if not exists sv_collection_archive (
    id                bigint generated always as identity primary key,

    username          text not null,               -- from the session cookie, never client-supplied
    release_id        bigint not null,
    instance_id       bigint not null,

    folder_id         integer,
    rating            smallint,
    fields            jsonb not null default '[]'::jsonb,   -- Discogs "notes": media/sleeve condition, notes text, custom fields
    barcode           text,
    date_added        timestamptz,

    -- Release metadata snapshot — URL references only, never re-hosted image bytes
    title             text,
    artist            text,
    year              integer,
    country           text,
    format            jsonb,
    label             jsonb,
    genre             jsonb,
    style             jsonb,
    catno             text,
    cover_image       text,
    thumb             text,

    provenance        text not null check (provenance in ('scan','search','matrix','photo','edit','backfill')),
    provenance_query  text,

    raw               jsonb not null default '{}'::jsonb,   -- forward-compat: whatever release object was on hand at save time

    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),

    constraint sv_collection_archive_username_instance_unique unique (username, instance_id)
);

create index if not exists sv_collection_archive_username_idx on sv_collection_archive (username);
create index if not exists sv_collection_archive_username_release_idx on sv_collection_archive (username, release_id);

alter table sv_collection_archive enable row level security;
-- No policies added intentionally — only the service-role key (server-side,
-- api/collection-archive.js) can touch this table. The anon key used by
-- src/lib/supabaseClient.js must never be able to read/write it directly.
