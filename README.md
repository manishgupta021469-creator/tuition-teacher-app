# Tuition Teacher App — V27

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
