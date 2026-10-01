# Tuition Teacher App V21

Based on V20. This version keeps the existing app features and changes only Teacher **Forgot Password** email delivery to use Gmail SMTP, so a separate Resend account/domain is not required.

## Render environment variables

Set:
- `GMAIL_USER` = `Manishgupta021469@gmail.com` (or the Gmail account used to send app emails)
- `GMAIL_APP_PASSWORD` = the 16-character Google App Password for that Gmail account
- `ADMIN_EMAIL` = `Manishgupta021469@gmail.com`
- `ADMIN_INITIAL_PASSWORD` = your initial Admin password (only needed if the admin account has not yet been initialized)
- `JWT_SECRET` = a long random secret
- `DATABASE_URL` = your existing Render PostgreSQL connection string
- `APP_URL` = your Render app URL (recommended)

Do NOT put the normal Gmail password in Render. Use a Google App Password.

## Teacher Forgot Password

Teacher enters the registered email, receives a reset link at that email, and the link expires after 30 minutes. No paid email API or custom domain is required.

## Admin

Only `Manishgupta021469@gmail.com` is authorized as Admin. Admin uses the configured Admin password and can reset it through the Gmail OTP flow. Other existing teacher/student/test/speech/PDF/WhatsApp functions are retained.
