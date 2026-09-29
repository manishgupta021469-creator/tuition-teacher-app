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
