# Tuition Teacher App

GitHub/Render-ready mobile-friendly tuition teacher web app.

## Important upload layout
All required runtime files are intentionally in the repository root so they can be uploaded from an Android phone without losing folder structure:

- `index.js` — Node/Express server
- `index.html`, `app.js`, `app.css` — web app
- `schema.sql` — PostgreSQL schema
- `package.json` — dependencies/start command
- `render.yaml` — Render Blueprint

## Render
Use the repository root as the service Root Directory (leave it blank). Render will run `npm install` and `node index.js`.

The Blueprint creates the web service and PostgreSQL database and supplies `DATABASE_URL`, `JWT_SECRET`, and `NODE_ENV`.


## Teacher account security
- After creating a Teacher ID, the dashboard shows a clear **Teacher ID created successfully** confirmation.
- A logged-in teacher can use **Change Password** from the dashboard.
- **Forgot Password** sends a time-limited reset link to the registered email address.
- Password reset email delivery uses the Resend API. On Render, set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` as environment variables. `APP_URL` is optional; if omitted, the current service URL is used.
- The reset token expires after 30 minutes and is stored only as a SHA-256 hash.

## V8 Speech Stability Fix
- Recreates the SpeechRecognition instance after browser/Android Chrome ends recognition during pauses instead of trying to restart a stale instance.
- Stop Test immediately detaches and aborts the active recognizer and then submits the final transcript.
- Handles `no-speech` and `network` interruptions with automatic recovery while preserving the transcript.
- Existing features remain unchanged.
