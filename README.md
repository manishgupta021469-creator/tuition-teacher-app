# Tuition Teacher App — V31

V27 keeps the existing V26 app features unchanged. The only functional change is the email delivery method for:
- Admin 6-digit password-reset code
- Teacher 30-minute password-reset link

## Why V27 changes email delivery
Render Free blocks outbound SMTP traffic on ports 25, 465 and 587. V27 therefore sends the email request over normal HTTPS to a free Google Apps Script Web App, and that script sends the email through the Gmail account that owns/authorizes the script.

## One-time Google Apps Script setup
1. Open Google Apps Script while signed in to the Gmail account that should send the app emails.
2. Create a new project.
3. Open `google-apps-script/Code.gs` from this ZIP and copy its full code into the Apps Script editor.
4. Replace `CHANGE_THIS_TO_A_LONG_RANDOM_SECRET` with a long random secret. Keep it private.
5. Save the project.
6. Click **Deploy → New deployment**.
7. Select **Web app**.
8. **Execute as:** Me.
9. **Who has access:** Anyone.
10. Deploy and authorize the requested Gmail permissions.
11. Copy the Web App URL ending in `/exec`.

## Render environment variables
In the existing Render service, add:
- `GMAIL_WEBHOOK_URL` = the Apps Script `/exec` URL
- `GMAIL_WEBHOOK_SECRET` = exactly the same secret used in `Code.gs`

The old `GMAIL_APP_PASSWORD` is no longer used by V27 and can be removed. No paid email API is required.

## Important
Do NOT delete the existing `tuition-db` database. Update only the existing app code in the GitHub repository and let the existing Render service redeploy.


## V28 Speech improvements
V28 keeps all V27 features unchanged and only improves the speech-test layer. It adds language-aware matching for Hindi + English paragraphs, pronunciation-tolerant word matching, Devanagari/Latin cross-script matching, and more tolerant selection of browser speech alternatives. The existing free browser SpeechRecognition engine remains the capture engine; no paid AI speech API or subscription is required.

The scoring layer is intentionally conservative: small pronunciation/transcription differences can match, while unrelated words are still treated as incorrect.


## V29 PWA install
V29 adds only Progressive Web App installation support. Existing API, database, login, teacher/student features, tests, speech matching, PDF, WhatsApp and Gmail reset flow are unchanged.

On Android Chrome, open the Render app URL, then use Chrome menu -> Add to Home screen / Install app. The installed app opens in a standalone app-style window with the Easyway Learn name and icon.


## V31 Manual underline and score correction
V31 preserves existing features and adds manual correction after a test is scored. Tap a word to toggle its underline, then select **Save manual underline and recalculate score**. The updated matched word indexes, word count, percentage, and PASS/NOT PASS are saved to that same attempt. The student/teacher can also open an older attempt from history and correct its underline where its original text is available. No new attempt is created, and canceled tests remain unsaved. The PWA cache name is bumped to V31 so updated assets can refresh.


## V33 update
- Added student-facing Pronunciation Help for each paragraph, with formula/equation reading guides and optional browser text-to-speech.
- Improved duplicate-final-speech filtering for Chrome recognition restarts.
- Existing app features, database schema, and manual underline behavior are preserved.


## V43 camera OCR quality update
The existing camera-and-scan workflow is retained. OCR now tries both contrast-adjusted grayscale and Otsu-binarized frames, compares confidence, and uses a phone-friendly processing size. Review the recognized text before saving; OCR is not guaranteed to be exact. No image is uploaded or stored by this client-side processing.

### V44 — Manual underline color and separate counts
- In the completed test score editor, words matched by speech recognition are underlined in green; words added manually by tapping are underlined in blue.
- The editor shows separate live counts for speech-detected words and manually marked words, plus the combined score.
- Saving still stores the final combined matched-word indexes using the existing API; no database schema change is made. The blue/green distinction and separate counts are for the active score-editing screen and are not stored as separate historical categories.


## V45 — Persist manual underline colors in saved history
- Saves manually added word indexes separately from the total matched word indexes.
- Reopens saved attempts with manually corrected words in blue in attempt history and PDF reports.
- Adds the `manual_word_indexes` JSONB column using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`; it does not reset or recreate the database.
- Existing attempts created before this change have no stored manual-word metadata, so their original manual blue words cannot be reconstructed automatically. New saves after deployment will preserve the blue markings.


## V46 — Microphone restart stability
- Kept the existing browser SpeechRecognition approach and all test/scoring flows.
- Fixed restart timing so Android Chrome waits for the previous recognition session to end before opening another one, reducing overlapping sessions and microphone dropouts.
- Added a safer delay after no-speech/network errors and bounded retry backoff for recoverable start/network failures.
- No database schema, account, history, report, OCR, or manual underline behavior changed.
- Speech recognition still depends on Android Chrome's Web Speech service, microphone permission, internet connection, and the device environment; this update cannot guarantee every spoken word will be recognized.
