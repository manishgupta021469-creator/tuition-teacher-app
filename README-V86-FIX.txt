V86 – Formula Editor input/button fix (based on V85)

Fixed the Formula Editor at the browser-control level:
- Formula Editor input remains a native textarea so Android/mobile keyboard typing works.
- Fraction, Superscript, Subscript and symbol toolbar buttons insert via textarea selection APIs.
- Cursor is retained after insertion and preview updates immediately.
- Existing paragraph editor, Formula Editor, formula pronunciation help, OCR, accounts,
  students, scores, attempts, history and database/API logic are otherwise unchanged.
