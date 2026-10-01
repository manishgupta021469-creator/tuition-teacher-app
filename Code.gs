/**
 * Tuition Teacher App - free Gmail HTTPS sender for Render Free.
 *
 * Deploy this file as a Google Apps Script Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Set the same long random secret in SECRET below and Render's
 * GMAIL_WEBHOOK_SECRET environment variable.
 */
const SECRET = 'CHANGE_THIS_TO_A_LONG_RANDOM_SECRET';

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.secret !== SECRET) {
      return json({ ok: false, error: 'Unauthorized' });
    }

    const to = String(body.to || '').trim();
    const subject = String(body.subject || '').trim();
    const html = String(body.html || '');

    if (!to || !subject || !html) {
      return json({ ok: false, error: 'Missing to, subject, or html' });
    }

    GmailApp.sendEmail(to, subject, stripHtml(html), { htmlBody: html });
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function stripHtml(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\\n')
    .replace(/<\/p>/gi, '\\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
