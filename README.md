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
