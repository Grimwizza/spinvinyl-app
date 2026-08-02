# SpinVinyl — Feature Recommendations

_Compiled from a product review session on 2026-08-02. This document is
self-contained and should remain useful as a reference across future
sessions and models, independent of any specific chat history._

## What's already built

SpinVinyl is a companion app for a user's Discogs vinyl collection. Major
existing capabilities:

- **Collection management**: Discogs OAuth login, full collection fetch
  with local caching and incremental sync, grid/list/3D-crate browsing,
  alpha-jump navigation, multi-field sort, free-text search.
- **Adding records**: live barcode scanning (native browser barcode
  detection with a JS-library fallback for unsupported browsers), manual
  title/artist search, matrix/runout-etching search for identifying exact
  pressings, and AI photo identification (snap a cover/label photo when
  there's no barcode) — all funnel into a shared add/edit flow covering
  rating, folder, condition, and notes.
- **Recommendations**: a "Spin Something" picker offering Forgotten Gems
  (low play-count records), time-of-day mood matching, and a random pick.
- **Album detail view**: full release metadata, community rating, artist
  bio, credits, tracklist with on-demand lyrics per track, estimated
  value, and links out to streaming services and the Discogs marketplace.
- **Stats**: spin counts by period, listening streaks, a GitHub-style
  activity calendar, most-played records, genre breakdown, collection
  value estimate, and a completed-artist-collections tracker.
- **Explore tab**: aggregated vinyl news, upcoming releases personalized
  to the user's collection, a "complete your collection" gap analysis
  per artist, wantlist management, and a nearby record store finder.
- **Data ownership**: a personal cloud backup of the user's collection
  and play history, independent of Discogs staying up or the user's
  Discogs account remaining active — explicitly scoped as per-user only,
  never a shared cross-user catalog, in line with Discogs' API terms.

## Gaps / recommendations, in priority order

Identified via an internal feature audit combined with research into
2026 vinyl-collector app competitors (Groovv, Spinstack, MusicBuddy,
Discographic, and others).

1. **Decade Breakdown stats card** — decade-level play data was already
   tracked and synced but never surfaced in the UI. _Status: built._
2. **Data export (JSON/CSV)** — let users download their own archived
   collection and stats. Reinforces the app's "own your data" position.
   _Status: built._
3. **Embedded streaming preview** — upgrade the album detail view's
   external streaming search-links into real inline preview playback,
   using video data Discogs' own release API already returns.
   _Status: built._
4. **Last.fm scrobble export** — let users optionally push their
   existing "Spin This" log to Last.fm, extending data already being
   collected rather than introducing a new concept. _Status: built._
5. **Lending tracker** — track who has borrowed a record. A common
   real-world collector need, addressable with no social/multi-user
   infrastructure. _Status: built._

## Considered, not built

- **NFC tap-to-log** (stick an NFC tag on a sleeve, tap to instantly log
  a spin) — a genuine differentiator in some competitor apps, but Web
  NFC has no meaningful iOS Safari support, and this app's primary
  audience is iPhone users. Worth revisiting if that changes.
- **Social features** (public share pages, following other collections,
  friend activity feeds) — real engagement potential, but the single
  biggest infrastructure/scope expansion of anything considered
  (multi-user visibility, privacy controls, moderation), and cuts
  against this app's deliberate direction toward a simple, personal
  companion experience rather than a social platform.
- **In-app marketplace** (buy/sell within the app) — meaningful
  liability (payments, fraud) or a fit for an app positioned as a
  personal companion rather than a marketplace; Discogs' own
  marketplace already exists and is linked from the album detail view.
- **Cleaning/maintenance reminders** — notable that no competitor app
  offers this either, so it's either a genuine unclaimed opportunity or
  evidence of low actual demand. Too speculative to prioritize without
  more signal from users.
