Easyway Learn — V126 Hindi App Usage Guide

Purpose
- Adds an in-app Hindi guide explaining how Teachers and Students use the app.
- The guide can be opened before login from the Welcome screen.
- The guide is also available from the Take Demo role-selection screen.
- A compact ? help button is added to authenticated app headers, where the screen has a header.
- The guide is a modal overlay so closing it returns to the same screen without clearing form fields or unsaved text.

Guide topics
- Teacher setup, student management, Learning Material hierarchy, Paragraph / Complete Chapter / Question-Answer / My Notes, voice tests, reports and histories.
- Student workflow: review text, listen where available, start test, allow microphone and finish for score.
- Microphone/Chrome troubleshooting and the word accuracy calculation.
- Demo data safety and the fact that demo test attempts may be saved to shared demo history.
- Clearly explains that this version does not have a separate password-based student login; real tests are started from the teacher portal, while Student Demo is an example walkthrough.

Files changed from V125
- app.js
- app.css
- sw.js (cache version bumped so the updated shell can replace the previous cached shell)
- README-V126-HINDI-APP-GUIDE.txt (new)

Safety
- No database schema, demo seed data, teacher/student records, scores, account/password logic, or existing learning-content flows were intentionally changed by this guide patch.
- The guide overlay does not route away from the current screen; it is removed on close.
- Demo tests can still create demo attempts according to existing V125 behavior; they may appear in shared demo history.

Deployment note
- This ZIP is source code. It does not update GitHub or deploy to Render automatically.
- After copying the included project files into the existing repository and deploying, check Render deploy status and reload the live portal.
- The user should not delete or recreate their database or change DATABASE_URL for this UI-only update.
