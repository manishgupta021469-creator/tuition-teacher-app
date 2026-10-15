Easyway Learn — V132: Principal opens the original Teacher Dashboard

BASE
- Based on V131 Clickable Principal + Individual Student Demo Fix.

REQUESTED BEHAVIOR
- In the real School Principal Dashboard, each teacher created by that Principal now has an “Open Teacher Dashboard” action.
- Clicking it uses the existing, original Tuition Teacher dashboard function and layout, rather than a new/parallel dashboard.
- In Take Demo, the Principal sample teacher profile also links to a preview of the existing original Teacher Dashboard. A visible notice explains that the preview uses shared Teacher Demo data because those sample profiles are fictional; the real Principal account opens the selected teacher’s own records.
- The Principal can then use the same teacher dashboard sections: Students, Learning Material (including material upload/management), Student Performance, test results/history, and other existing teacher features.
- A “Back to Principal” control returns to the Principal account/dashboard. The Teacher dashboard’s Logout button also returns to Principal while this delegated view is active.
- The normal Teacher Login / Create Teacher Account flow and standalone Teacher dashboard are not replaced.

SECURITY / DATA SCOPE
- Only teachers whose teachers.school_principal_id matches the authenticated Principal can be opened.
- The delegated token is short-lived (2 hours), includes both teacher ID and principal ID, and is validated against the database on each teacher API request.
- The teacher and Principal must still exist and be unblocked; a blocked teacher cannot be opened.
- The delegated role can access the existing teacher endpoints only. It is denied Admin, School management, and Individual Student endpoints.
- Teacher-owned API calls still use the selected teacher ID, so their students, learning material, scores and reports remain scoped to that teacher.

PRESERVED
- Existing Teacher dashboard markup and normal Teacher account creation/login flow remain unchanged.
- Existing app colors, visual design, and other dashboard actions remain in place; only the new Principal action and return control are added.
- No existing records or database tables are dropped/reset. No database schema migration is required for this feature.
- Existing School Principal/Individual Student registrations and portals remain.

TESTING
- Node syntax checks passed for server and browser JavaScript.
- ZIP integrity check passed.
- The new authenticated flow has not been executed against the live PostgreSQL/Render deployment in this environment. Test with a backup/staging database before deploying, and do not delete/recreate the existing database.
- No Render deployment was performed by preparing this ZIP.
