# AI Carousel Generator (Prototype)

A responsive, full-stack prototype for generating AI-assisted carousel slides from a topic, tone, style, and slide count.

## Features implemented

- Input form for topic, tone, image style, and slide count.
- Asynchronous, job-based backend generation flow:
  - `POST /api/generate` creates a generation job.
  - `GET /api/jobs/:jobId` returns progress, status, and completed result.
- Visual customization controls:
  - Structured, polished site header and footer layout inspired by research-assistant style app framing.
  - Light/Dark mode toggle.
  - Carousel color themes (Aurora, Sunset, Midnight, Mint).
  - Font selection (Inter, Poppins, Merriweather).
- Rich slide preview cards with better visual hierarchy and image overlays.
- Carousel preview grid with drag-and-drop reordering.
- Slide editor for headline, body, CTA, and image replacement URL.
- Export full carousel to PDF with metadata (`title`, `subject`, `author`, `keywords`, `creator`) including selected theme/font context.
- Export selected slide as PNG image.
- Progress indicator and status messaging during generation.
- Responsive desktop/tablet-first layout.
- Localhost-safe behavior: service-worker caches are auto-cleared/disabled in local dev to prevent stale broken layouts.
- Installable PWA support:
  - Web app manifest (`display: fullscreen`)
  - Service worker for app-shell caching
  - Install prompt handling for supported browsers
- Zero runtime dependencies (runs on Node built-ins only).

## Quick start

```bash
npm run check
npm start
```

Open <http://localhost:3000>.

## Notes

- This version uses deterministic placeholder images from Picsum to simulate image generation.
- The generation route is structured so you can replace mock logic with real LLM and image APIs.
