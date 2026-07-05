# Wiring the waitlist form to a Google Sheet

This has to be done once in your own Google account — Claude can't create
Google resources or sign in for you. It takes about 5 minutes.

## 1. Create the sheet

Create a new Google Sheet (e.g. name it "RPGym Waitlist").

## 2. Add the Apps Script

In the sheet: **Extensions → Apps Script**. Delete whatever's in the editor
and paste this in its place:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Waitlist")
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet("Waitlist");

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Timestamp", "Email", "Consent"]);
  }

  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([data.created_at, data.email, data.consent_given]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Click the save icon (or Ctrl/Cmd+S), and give the project a name like
"RPGym Waitlist Backend" when prompted.

## 3. Deploy it as a Web App

1. Top right: **Deploy → New deployment**.
2. Click the gear icon next to "Select type" → choose **Web app**.
3. Settings:
   - Description: `RPGym waitlist`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**. Google will ask you to authorize the script — approve
   it (it's your own script accessing your own sheet, so this is safe).
5. Copy the **Web app URL** it gives you. It looks like:
   `https://script.google.com/macros/s/AKfycb.../exec`

## 4. Point the site at it

Open `js/waitlist.js` and paste the URL in at the top:

```javascript
const GOOGLE_SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycb.../exec";
```

Save, bump the `?v=` cache-busting number on the script tag in
`index.html` (and `privacy.html`'s stylesheet link if you touched CSS
too), and you're done — new waitlist signups will land as rows in the
"Waitlist" tab of your sheet.

## Notes

- The site uses `mode: "no-cors"` when calling the script, since Apps
  Script doesn't send back headers a static page can read. That means the
  page can't tell if the write actually failed — if rows stop appearing,
  check **Executions** in the Apps Script editor for errors, most often
  caused by re-deploying without bumping to a "New deployment" (editing
  the script and just saving does **not** update the live `/exec` URL's
  code — you need Deploy → Manage deployments → edit → New version).
- Only email, consent, and timestamp are collected, matching the
  commitment in `privacy.html`. Don't add extra columns/fields without
  updating that page too.
