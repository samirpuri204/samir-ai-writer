# ScholarForge AI — by Samir Puri

A Vercel-ready 3D Assignment Writer + Lab Task Writer powered by OpenRouter.

## AI model

Default model:

```text
openrouter/free
```

You can override it with `OPENROUTER_MODEL` without editing code.

## Features

- Professional Assignment Writer mode
- Professional Lab Task Writer mode
- Optional lab format/template upload
- Automatic extraction of visible title, subject/course, academic level, word/page limit, citation style and questions from uploaded briefs
- Multiple question images/files in one task (up to 8, subject to combined request size)
- Supports PDF, PNG/JPG/WEBP/GIF, TXT and Markdown inputs
- Three.js animated hero scene
- Framer Motion page/studio transitions
- 3D developer credit for **Samir Puri**
- Responsive glass + neon UI
- Server-side OpenRouter API proxy (API key is never exposed to the browser)
- Markdown rendering, copy, and `.md` download
- Reduced-motion accessibility fallback

## Local setup

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openrouter/free
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Then:

```bash
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. Import the repository in Vercel.
3. In **Project → Settings → Environment Variables**, add:
   - `OPENROUTER_API_KEY` = your OpenRouter key
   - `OPENROUTER_MODEL` = `openrouter/free`
   - `NEXT_PUBLIC_SITE_URL` = your final Vercel/custom-domain URL
4. Deploy.

Do **not** prefix your API key with `NEXT_PUBLIC_`; that would expose it to browser JavaScript.

## Free model notice

The default model is OpenRouter's free `openrouter/free` endpoint. Free endpoints can be rate-limited or temporarily unavailable, so the app now surfaces provider/server errors cleanly instead of crashing while parsing a non-JSON error page.

## Upload behavior and size note

Question uploads can contain multiple images/files. Images are resized/compressed in the browser before being sent. The UI supports up to 8 question attachments but also enforces a conservative combined serialized payload limit so Vercel serverless requests stay practical. PDFs are capped separately at 2.5 MB and text files at 1 MB.

After question upload, `/api/extract` uses the configured OpenRouter model to detect metadata and transcribe the actionable questions. Detected values fill only empty/default fields so manual user input is preserved.
