Easyway Learn — V131: Clickable Principal and Individual Student Demo

BASE VERSION
- Based on V130 School Principal + Individual Student Demo ZIP.

FIXES IN THIS VERSION
- Principal demo dashboard metric cards are clickable and open clear detail screens.
- School Teachers list shows all 8 sample teachers. Opening a teacher shows contact info, assigned student count, test submissions, average performance, and student list.
- Opening a student shows profile/class, associated teacher, test count, sample performance by subject, and test history. Each history row opens the test result with score/accuracy and correct/total words.
- Teacher-specific test and report views list students and their test counts/scores. The overall sample submission total remains consistent with the student-level sample test counts.
- The all-students view supports searching by student or teacher.
- Subject and material cards open Book / Chapter details. Publish and Unpublish toggle the demo-only subject visibility for Individual Student Demo.
- Individual Student Demo now has an explicit how-to-use section and clickable navigation: Subject -> Book -> Chapter -> Paragraph / Complete Chapter / Question Answer / My Notes -> Test -> Result -> Test History.
- The demo test accepts typed text or browser speech recognition where supported and adds a result to the demo session's in-memory test history. Demo results are not stored in the live database.
- The app shell cache name and package version are advanced to V131 to help updated clients receive the revised demo code.

PRESERVED
- Existing Tuition Teacher registration/login, teacher dashboard, existing student demo, and all non-demo app behavior are unchanged by this patch.
- Only the Principal/Individual Student demo UI, associated demo-only styles, version marker, and this README are changed from V130.
- No existing account, material, result, score history, or PostgreSQL data is reset or deleted.
- No Render deployment has been performed. The ZIP must be reviewed and tested against a safe backup before deployment.

DEMO DATA
- The names, emails, classes, scores and test records shown in Principal/Individual Student Demo are fictional sample data and are held only in the browser session.
- Create Teacher ID and password buttons inside the Principal Demo do not create real accounts or change real passwords.
