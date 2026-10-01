# Tuition Teacher App — V24

Base: V23. Only the requested Admin teacher-management and Gmail password-reset/security features were added. Existing PDF multi-attachment/select-all and other app features are preserved.

## Admin
- Fixed Admin email: `Manishgupta021469@gmail.com` (or `ADMIN_EMAIL` in Render).
- Admin can open/check a teacher dashboard.
- Admin can set a new teacher password.
- Existing teacher passwords are stored as secure hashes and are **not viewable**, even by Admin.
- Admin can block/unblock a teacher. A blocked teacher cannot log in.
- Admin can permanently delete a teacher (existing 3-confirmation flow).

## Gmail password reset
- Teacher Forgot Password sends a reset link to the teacher's registered email using Gmail SMTP.
- Admin Forgot Password sends a one-time code to the fixed Admin email using Gmail SMTP.
- Reset links expire after 30 minutes.
- Admin reset codes expire after 10 minutes and are single-use.

## Render environment variables
Set these in Render > Environment:
- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL=Manishgupta021469@gmail.com`
- `ADMIN_INITIAL_PASSWORD` (only needed the first time if `admin_account` is not initialized)
- `GMAIL_USER=Manishgupta021469@gmail.com`
- `GMAIL_APP_PASSWORD=<Google 16-character App Password>`
- `APP_URL=https://YOUR-APP.onrender.com`

Do not put the normal Gmail password in `GMAIL_APP_PASSWORD`. Use a Google App Password.
