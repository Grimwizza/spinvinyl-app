# SpinVinyl — Explore Tab Stickiness Recommendations

_Compiled from an Explore-tab review session on 2026-08-04. This document is
self-contained and should remain useful as a reference across future
sessions and models, independent of any specific chat history._

## Context

The Explore tab is the only part of SpinVinyl usable without a Discogs
account, and just became the app's default landing page for unauthenticated
visitors. This review's core question: what would give people — both
existing collectors and browsing-only guests — a reason to open the app
again tomorrow, rather than only when they've just bought a record?

## What already exists (don't rebuild this)

- **Local engagement tracking**: `statsEngine.js` already computes a daily
  listening streak (`getCurrentStreak`), a GitHub-style calendar heatmap of
  spins by day (`getDayMap`), per-album play counts, and genre/decade/label
  breakdowns — all local-only (localStorage), surfaced today on the
  (auth-gated) Stats page.
- **Personalization infrastructure**: Upcoming Releases and Music News both
  already score/tag content against the user's real collection (artist-name
  matching, genre-weighted scoring) — this pattern is proven and reusable,
  not something to reinvent per new feature.
- **PWA install nudge**: a manifest + platform-sniffed "Add to Home Screen"
  instruction card (`PWAHelp`), self-dismissing and self-hiding once
  installed — but no `beforeinstallprompt` capture, so it's static
  instructions, not a native one-tap install button.
- **What's genuinely missing**: any notification/reminder mechanism
  (no service worker, no Push API usage, no email) and any sharing/social
  feature (no `navigator.share()`, no share pages, no invite flow).

## Recommendations, in priority order

1. **Weekly Recap card in Explore.** Surface "this week: N spins, N new
   artists discovered, current streak" using data `statsEngine.js` already
   collects — zero new infrastructure, purely a new read of existing local
   data. The cheapest, most obviously additive option here, and a natural
   first thing to build next. _Status: built._

2. **"On this day."** Records added to the collection on this date in a
   previous year (`date_added` is already synced per item). Also zero new
   infrastructure — a nostalgia hook that costs almost nothing to build.
   _Status: built._

3. **Streak-preservation nudge.** Pair the existing streak count with the
   existing PWA install card's real estate — "3-day streak, don't lose it,
   spin something today" — reusing both pieces of infrastructure already
   built rather than introducing a third mechanism.

4. **Push notifications** ("new release from an artist you own," "a
   wantlist item just became available," "your streak is about to break").
   The highest-value idea for genuine day-later re-engagement — this is
   the category of feature that actually pulls someone back to an app —
   but also the biggest lift: needs a service worker, Push API
   subscription handling, and server-side subscription storage +
   trigger logic, none of which exist today. Worth prioritizing once the
   cheaper wins above are shipped and validated.

5. **Community pulse** (an aggregate, anonymized cross-user signal — e.g.
   "X collectors are watching this upcoming release" — drawn from the
   existing shared Supabase project). Flagged as a genuine future idea,
   not a near-term build: it needs real privacy/consent design before any
   implementation work starts, since it's the first feature that would
   make one user's activity visible (even in aggregate) to others in an
   app that has been deliberately single-player so far.

## Considered, not recommended

- **Email digest** — would need email infrastructure (sending, unsubscribe
  handling, deliverability) that doesn't exist anywhere in this project;
  push notifications cover the same "pull them back" need with less new
  surface area to build and maintain.
- **Full social features** (public profile pages, following other
  collectors, friend activity feeds) — same reasoning as the earlier
  product-review doc (`feature-recommendations.md`): the single biggest
  infrastructure/scope expansion of anything considered, and cuts against
  the app's deliberate personal-companion direction. Community Pulse
  (above) is the bounded, lower-risk version of this idea if any
  social-adjacent feature is wanted at all.
