Easyway Learn V133 — Same Dashboard for Principal and Individual Student Demo

Purpose
- Fix Take Demo so School Principal and Individual Student previews use the existing Tuition Teacher Dashboard shell instead of a separate invented dashboard layout.
- Keep the original Teacher Demo and original Student Demo flows available.

School Principal Demo
- Each teacher row now includes an explicit “Open Teacher Dashboard” action.
- It opens the existing dashboard() screen, with the selected sample teacher's name in the header and a “Back to Principal Demo” control.
- The dashboard uses the existing Students, Learning Material, Student Performance, Recent Activity, subject/book/chapter, upload/edit, and test flows.
- This remains demo-only: the eight principal sample teachers are illustrative profiles, while the opened dashboard uses the existing shared demo account's sample records. It does not create eight separate backend demo teacher accounts.

Individual Student Demo
- Opens the same existing dashboard() layout, branded as “Individual Student” and using the sample name Aarav Mishra.
- Students shows only one sample profile; Add Student is hidden and Delete Student is hidden for that self-profile.
- Existing material, chapter, test, result, and history navigation is reused.
- “Back to Demo Roles” and logout return to the demo role chooser.

Safety and compatibility
- The pre-existing Teacher Login/Create Teacher Account flow and old Teacher/Student Demo functions were not intentionally changed.
- No live deployment was performed. The package has not been tested against the live PostgreSQL database.
- Demo data only. Do not use real student personal information in demos.
