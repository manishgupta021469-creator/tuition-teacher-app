# Tuition Teacher App

GitHub/Render-ready mobile-friendly tuition teacher web app.

## Implemented
- Unlimited separate teacher accounts (email/password + JWT).
- Teacher-isolated data.
- Up to 20 students per teacher; student IDs have name/class and no password.
- Unlimited subjects, books and chapters.
- Chapter text paste automatically splits into paragraphs.
- Paragraph editing, adding and adjacent-paragraph merging.
- Q&A question + correct-answer storage.
- Paragraph speech tests run sequentially, one paragraph at a time.
- Original paragraph is hidden after **Start Test**.
- Complete chapter test is available after all paragraph tests in the sequence finish.
- Q&A tests run sequentially for all saved Q&A items.
- Hindi/English browser speech recognition using Chrome Android as the primary MVP target.
- Conservative word-level LCS matching: only matched reference words are marked/underlined; unmatched words are left unmarked.
- 80% pass threshold.
- Test results saved per student and chapter.
- Teacher dashboard shows student performance ordered by average score.
- Server validates the real stored reference text before scoring, so the browser cannot change the answer/reference being scored.
- No demo/sample data is inserted by the application.

## Local run
1. Create PostgreSQL database.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` and a strong `JWT_SECRET`.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:10000`.

## Render
The included `render.yaml` creates a web service and PostgreSQL database. Review the current Render dashboard requirements/pricing before deploying.

## GitHub
Upload the project files to a new repository. Do not commit `.env`; use Render environment variables for secrets.

## Speech recognition note
Browser speech recognition quality depends on the device, microphone, browser and network. The scoring/matching algorithm is deterministic once speech has been transcribed. Hindi + English mixed speech is supported as an MVP target, but browser Web Speech API language models can vary; production deployments may later replace the browser recognizer with a dedicated multilingual speech-to-text service if higher consistency is required.
