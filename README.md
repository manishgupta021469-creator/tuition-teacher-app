# Tuition Teacher App V26 — Admin Gmail Reset Fix

Base: V25. This version fixes the Admin Forgot Password flow without removing existing functions.

## Admin reset fixes
- Admin reset code input is visible immediately; it is no longer hidden waiting for the email request to succeed.
- Admin reset code is a 6-digit code sent to `Manishgupta021469@gmail.com`.
- OTP is stored only after Gmail successfully accepts the email, so a failed send does not leave a unusable code or block the next request.
- Gmail transport uses Nodemailer's Gmail service configuration for better compatibility on Render.
- Gmail App Password whitespace is removed automatically.
- Admin account does not need to exist before the first reset; successful code verification creates/updates the Admin password.
- Check Gmail Inbox, Spam and Promotions.

## Render environment variables
Set these on the Render web service:
- `ADMIN_EMAIL=Manishgupta021469@gmail.com`
- `GMAIL_USER=Manishgupta021469@gmail.com`
- `GMAIL_APP_PASSWORD=<Google 16-character App Password>`
- `APP_URL=https://tuition-teacher-app.onrender.com`

Do not use the normal Gmail password. Do not share the App Password in chat.
