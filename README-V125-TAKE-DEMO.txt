Easyway Learn — V125 Take Demo Portal

What changed
- Adds a Take Demo button beside the existing Login and Create Teacher Account choices.
- Take Demo opens a role choice: Teacher Demo or Student Demo.
- Student Demo lists five sample Class 6 (UP Board) students.
- Seeds six subjects, two books per subject, nine chapters per book, two paragraphs per chapter, two Question-Answer items and one My Notes item per chapter.
- Adds a pre-filled saved test record for every student and every paragraph, Q&A item, My Notes item, and Complete Chapter item (3,240 initial demo attempts in total).
- Includes a clear notice that the lesson text is sample demo content, not an official verbatim UP Board textbook.
- Stores the demo data under its own marked demo teacher account. Existing teacher accounts, passwords, student records, content and test histories are not intentionally changed.
- Prevents edits/deletions to shared demo content and students. The normal test score endpoint still works so visitors can try a test; those new attempts are saved to the shared demo history.
- Excludes the demo account from Admin's normal teacher list.
- Optimizes the content API to load the larger demo library with batched queries rather than one query per content item.

Deployment note
- This ZIP contains source changes only. It has not been deployed to Render and does not update GitHub/Render automatically.
- On the first Take Demo click after deployment, the server creates the demo teacher and sample data transactionally. The first click can take longer than later demo opens.
- The app still requires the existing DATABASE_URL and other current Render configuration.
