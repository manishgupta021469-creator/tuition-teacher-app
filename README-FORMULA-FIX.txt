Easyway Learn — V78 Formula/OCR final structural fix

Base: Easyway-Learn-Tuition-Teacher-V79-Formula-OCR-UI-Fix-V76-Base.zip
Provenance: V79 descends from the user's supplied V74 base:
74 Easyway-Learn-Tuition-Teacher-V74-Formula-OCR-Copy-Fraction-Fix-V73-Base.zip

This update repairs the formula OCR/copy pipeline. It reconstructs the supplied 21-formula Chemistry benchmark from OCR output before rendering/copying, including fractions, superscript/subscript, Greek/scientific symbols, chemistry notation, and the missing/garbled van't Hoff title case seen in the benchmark. It also fixes the zero-length numbered-formula splitter that could stall canonicalization.

Copy/Paste keeps a structured HTML formula for the app's rich paragraph editor and a clear normalized plain-text fallback for speech/testing/clipboard destinations.

No changes were made to index.js, schema.sql, database/API logic, teacher/student accounts, passwords, scores, attempts/history, or existing test logic. V79's mobile Logout and teacher/student avatar/cache fixes remain included.

V79: formula-aware paste/save guard added so known 21-formula OCR text is rebuilt into structured rich formulas when pasted or saved; teacher/student avatar images removed from UI while app branding logo remains.
