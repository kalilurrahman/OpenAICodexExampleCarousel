# AI Carousel Generator (Prototype)

A responsive, full-stack prototype for generating AI-assisted carousel slides from a topic, tone, style, and slide count.

## Features implemented

- Input form for topic, tone, image style, and slide count.
- Asynchronous, job-based backend generation flow:
  - `POST /api/generate` creates a generation job.
  - `GET /api/jobs/:jobId` returns progress, status, and completed result.
- Carousel preview grid with drag-and-drop reordering.
- Slide editor for headline, body, CTA, and image replacement URL.
- Export full carousel to PDF with metadata (`title`, `subject`, `author`, `keywords`, `creator`).
- Export selected slide as PNG image.
- Progress indicator and status messaging during generation.
- Responsive desktop/tablet-first layout.
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
