# SpinVinyl App Guide

## Build & Dev Commands
- Start dev server (Vite): `npm run dev`
- Build production bundle: `npm run build`
- Run linter (ESLint): `npm run lint`
- Preview production build locally: `npm run preview`

## Tech Stack & Architecture
- **Frontend**: React (v18) + Vite + Tailwind CSS
- **API Routes**: Serverless functions located in `/api` (proxied in dev via `vite-api-proxy.js` and defined in `vite.config.js`)
- **Database/Auth**: Supabase client (`@supabase/supabase-js`)
- **Key Libraries**: Lucide React (icons), Leaflet (interactive maps), ZXing (barcode scanning)

## Coding Guidelines
- **Components**: Functional components with hooks.
- **Styling**: Tailwind CSS + Vanilla CSS (Mobile-First responsive design).
- **Icons**: Prioritize lightweight icons (Lucide React) over heavy icon packages.
- **Routing**: Client-side routing with standard React setup.

For agent operational protocols and token stewardship guidelines, see [AGENTS.md](file:///Users/benluebbert/Documents/Sites/spinvinyl-app/AGENTS.md).
