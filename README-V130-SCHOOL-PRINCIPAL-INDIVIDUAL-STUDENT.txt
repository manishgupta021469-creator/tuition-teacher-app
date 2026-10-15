Easyway Learn — V130: School Principal + Individual Student

This ZIP is based on the previous V129 Render version.

PRESERVED
- Existing Tuition Teacher Login and Create Teacher Account form/flow remain unchanged.
- Existing Teacher Portal features, dashboard routes, styles/colors, score history and existing Take Demo Teacher/Student flows remain in place.
- Existing PostgreSQL data is not reset, dropped, or reseeded by these additions.
- No Render deployment is performed by preparing this ZIP.

NEW REGISTRATION OPTIONS
1. School Principal ID
   Required: School Name, Principal Name, Email ID, Mobile Number and password.
   Principal dashboard: create school-linked Teacher IDs; review linked teachers, school students, scores/reports and learning materials; change teacher passwords; block/unblock teacher IDs; publish/unpublish subject material for Individual Student access; remove a student or material.

2. Individual Student ID
   Required: Student Name, Mobile Number, Email ID, Class/Preparation and password.
   Student portal: browse material published by a school principal; read Paragraph, Complete Chapter, Question Answer and My Notes; submit a reading test by microphone where supported or by typing text; see saved scores and test history.

ADMIN
- Existing Admin role remains the top-level role. Admin panel now also lists School Principal IDs and Individual Student IDs, with password reset, block/unblock and delete controls.

TAKE DEMO
- The existing Teacher Demo and Student Demo choices remain available.
- New School Principal Demo and Individual Student Demo choices are added using clearly labeled sample data. These sample demo screens do not create real accounts or modify live records.

DATABASE SAFETY
- New database tables are created with CREATE TABLE IF NOT EXISTS.
- New columns are added with ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
- No old tables are dropped. Existing teachers remain standalone tuition teachers unless a Principal creates their account through the School Principal dashboard.
- Subject materials default to unpublished for Individual Student access. A Principal must explicitly publish a subject for the global published-material listing.

DEPLOYMENT NOTES
- The app still uses the existing DATABASE_URL, JWT_SECRET and existing Render environment settings. No new paid API is required.
- When this ZIP is deployed to an existing Render Web Service, the normal app startup runs additive schema migrations. Do NOT delete/recreate the PostgreSQL database.
- Before deploying, keep an independent export/backup of the current PostgreSQL database. This ZIP has not been deployed or tested against the live Render database.
- Browser speech recognition requires browser/device support and microphone permission. Student can type spoken text if speech recognition is unavailable.
