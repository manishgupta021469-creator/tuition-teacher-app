# Easyway Learn — Tuition Teacher App — V56

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


## V47 Camera, OCR and interface improvements
V47 keeps the existing teacher/student, test, score/history, PDF, WhatsApp, speech-recognition, and database functionality in place. It improves the app branding and mobile interface, adds a manual camera-open → capture photo → recognize text flow for chapter/paragraph text and Question & Answer fields, and adds clipboard-paste actions to the relevant text fields. The camera is not opened until the user presses a camera button. OCR remains browser-based with Hindi + English recognition; please review recognized text before saving.

The V47 ZIP does not change `index.js` or `schema.sql`. Do not reset, delete, or recreate the existing Render database; deploy the updated app code to the existing service.


## V53 combined update (October 2026)
- Complete Paragraph Test combines all saved paragraphs in chapter order and records one chapter-level attempt; newly added paragraphs are included dynamically. The app's existing speech/read-aloud behavior is unchanged.
- Teacher chapter material now offers separate Paragraph and Question-Answer routes.
- Camera panel adds best-effort torch and optical/device zoom controls where supported, and captures a centered 4:3 document frame. OCR continues to use Hindi + English Tesseract processing with review-before-save. OCR and browser speech recognition depend on device/browser capabilities and cannot guarantee zero errors.
- Speech recognition restart timing is less aggressive and keeps available interim words when a browser session ends, to reduce lost words. Microphone accuracy still depends on Android Chrome/Web Speech service, connectivity, permissions, and device conditions.
- Login, Create Teacher Account, and Admin Login are separated into a choice screen. Student deletion is available on the student page instead of the dashboard list. Student results include weighted chapter/book/subject accuracy navigation.
- No database reset or schema change was added in this update. Existing database records remain in place.


## V54 Combined Update (2026-10-04)
- Teacher login is required once per new calendar day (India date); the same login remains usable during that calendar day.
- Admin Login is hidden from the normal Teacher entry screen and is available only at the same Render URL under `/admin`. Server-side Admin authentication remains enforced.
- Teacher account creation now shows “Account Created Successfully” after successful registration.
- Test attempts show the recorded date and time in history/result views.
- Improved speech-recognition restart/language handling from the prior combined build; browser/device speech-service limitations still apply.
- Camera controls from the prior build remain: 4:3 preview, supported-device Flash and hardware Zoom.
- OCR improvements from the prior build remain: Hindi+English recognition, text editing, and preserved paragraph ordering/line breaks as far as OCR permits.
- Complete Paragraph Test remains one combined test using all chapter paragraphs in serial order, without a Next step between paragraphs.
- Teacher material flow remains Subject → Book → Chapter → Paragraph / Question-Answer.
- Student delete remains on the student page; dashboard delete buttons remain removed.
- The “Easyway Learn” branding is slightly larger/more professional.
- PWA manifest now uses the SVG app icon and the unused PNG icon files are not included, to avoid the browser repeatedly fetching the small PNG logo as a media file.
- No database reset, account deletion, score/history reset, or replacement of existing data is performed by this build.

**Important:** Test the ZIP locally first. Do not deploy it over the live Render service until login, Admin `/admin`, existing teacher/student data, tests/history, camera/OCR, and WhatsApp/PDF flows have been checked.


## V56 — Speaker Stop, Admin Activity and OCR Reliability
- Added a clear Speaker OFF / Stop control in the paragraph pronunciation screen.
- Added server-side teacher activity tracking for today's login date, last app open time/mode, and PWA installation detection when the app is opened in standalone/install mode.
- Admin Teacher Activity now shows Today Login and App Install status.
- Added multi-pass Hindi+English OCR preprocessing (original, contrast-enhanced and binarized passes) and selects the strongest result. OCR remains best-effort and cannot guarantee 100% accuracy for every image/font/formula.
- Gallery images remain client-side only and are not uploaded or stored by this OCR flow.
- Existing accounts, scores, test history and database are not reset or recreated. New teacher activity columns are added with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- The PWA cache version is bumped so updated files can refresh.

### Installation-status limitation
A website cannot universally prove that an app is installed on every Android launcher. This build marks a teacher as installed when the PWA is detected in standalone/fullscreen/minimal-ui mode or when the browser's `appinstalled` event is observed. If a teacher only uses the normal browser, Admin will show `NOT DETECTED`; that does not prove the teacher has never installed the app.

### Important
Test the ZIP locally first. Do not deploy over the live Render service until teacher login, Admin `/admin`, existing teacher/student data, tests/history, camera/OCR, Speaker ON/OFF, and WhatsApp/PDF flows have been checked.


## V58 — Gallery Icon Fix (V56 Base)
This release is rebuilt directly from V56 Final Combined Updates. Existing features, logic, database schema and data behavior are preserved. PWA icons were moved into `pwa-assets/`, converted to PNG, and the folder contains an Android `.nomedia` marker so the media scanner should not index the PWA icon files into Gallery when a project ZIP is extracted into Downloads. Manifest, favicon, app-logo and service-worker references were updated. Old root SVG icon files are removed from this release. Existing files already stored on a phone from older V55/V56/V57 ZIP folders are not deleted automatically and should be removed once manually.


## V59 — Google Lens OCR Option (V58 Base)
- Built directly from V58 Gallery Icon Fix (V56 Base).
- Added a separate Google Lens OCR button to the existing Document Camera / Gallery panel.
- On Android, it attempts to open the Google Lens app; if that is unavailable, it falls back to the Google Lens web page.
- Existing Camera OCR, Gallery Image Scan, Flash, Zoom, test logic, accounts, histories and database behavior are unchanged.
- Lens is an external option: text recognized by Lens must be copied and pasted back into the Easyway Learn text field; Google Lens OCR is not embedded inside the PWA.

## V62 — Gallery OCR + Mic Reliability Update (V61 base)
- Built from the latest actual V61 ZIP available in the project library.
- Removed the Live Camera OCR workflow from the visible teacher content-entry UI. The existing Gallery-photo OCR workflow remains.
- Removed the separate Google Lens-style/external Lens option. No Google Lens app or Play Store is opened.
- Gallery OCR now gives a dedicated editable OCR result box with Copy Selected, Copy All, Share Text and Paragraph Paste controls. Selected text can be shared or copied before inserting it into the target field.
- Gallery OCR keeps the image client-side and does not upload/store the selected image in the app database/server through this flow.
- Gallery OCR preprocessing was strengthened: higher-resolution scaling where practical and four OCR passes (original, contrast, binarized and alternate page-layout recognition) with a best-result selection. Hindi + English Tesseract recognition remains best-effort; formulas, unusual fonts and poor photos still need review.
- Speech recognition restart handling was made more responsive around normal pauses/no-speech events, and the UI now explicitly indicates that a pause/hesitation does not mean the microphone test has ended. Existing scoring/history APIs and test logic were not changed.
- Existing accounts, students, content, scores, attempt history, database and unrelated features are preserved. No database reset/recreation is performed.

**Validation performed:** JavaScript syntax check passed and the ZIP archive was tested after packaging. Live Android microphone/Gallery OCR behavior still needs to be checked on the actual phone because Web Speech/Tesseract behavior depends on browser, network, permissions and device.
