-- Lending tracker — adds nullable columns to the existing per-item archive
-- table (sv_collection_archive). Deliberately NOT a new table: lending
-- status is intrinsically per-collection-item data, same granularity as
-- everything else already on that row.
--
-- Run this once by hand in the Supabase SQL editor, after
-- schema_collection_archive.sql has already been applied. See that file's
-- header for the "no migration tooling" context this mirrors.

alter table sv_collection_archive
    add column if not exists lent_to    text,        -- borrower name, null = not lent out
    add column if not exists lent_at    timestamptz, -- when it was marked lent
    add column if not exists lent_notes text;         -- optional free-text note
