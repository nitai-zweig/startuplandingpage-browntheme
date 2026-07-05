/**
 * RPGym waitlist form handling.
 *
 * BACKEND: Google Sheets, via a Google Apps Script "Web App" bound to the
 * sheet. This requires a one-time setup in YOUR Google account (Claude
 * can't create Google resources or sign in on your behalf) — see
 * GOOGLE_SHEETS_SETUP.md in this folder for exact copy-paste steps.
 *
 * Once set up, paste the Web App URL you get from Google into
 * GOOGLE_SHEETS_WEB_APP_URL below. Until then, this falls back to storing
 * signups in the visitor's own browser (localStorage) so the form stays
 * fully demoable.
 */

// Paste your Apps Script Web App URL here once you've deployed it
// (see GOOGLE_SHEETS_SETUP.md). Looks like:
// "https://script.google.com/macros/s/AKfycb.../exec"
const GOOGLE_SHEETS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycby805dGXl-5DcGWCQRXQ7Mu2MCRpx-Q9DP2hVZMekz91PhAtvR1s_aSo-5R0FwDs8e6/exec";

const WAITLIST_STORAGE_KEY = "rpgym_waitlist_local_dev";

async function submitToBackend(payload) {
  if (!GOOGLE_SHEETS_WEB_APP_URL) {
    // Fallback while the Google Sheet isn't wired up yet: keep local so
    // the form is still testable end-to-end during development.
    const existing = JSON.parse(
      localStorage.getItem(WAITLIST_STORAGE_KEY) || "[]",
    );
    existing.push(payload);
    localStorage.setItem(WAITLIST_STORAGE_KEY, JSON.stringify(existing));
    return { ok: true };
  }

  // Apps Script Web Apps don't send back CORS headers a static page can
  // read, so this uses mode:"no-cors" — the request still reaches the
  // sheet and appends the row, we just can't inspect the response body.
  // Content-Type "text/plain" keeps this a CORS "simple request" (no
  // preflight), which Apps Script doesn't handle; the script parses
  // e.postData.contents as JSON on its end. See GOOGLE_SHEETS_SETUP.md.
  await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  return { ok: true };
}

function initWaitlistForm() {
  const form = document.getElementById("waitlist-form");
  if (!form) return;

  const emailInput = document.getElementById("email");
  const consentInput = document.getElementById("consent");
  const errorEl = document.getElementById("form-error");
  const submitBtn = document.getElementById("submit-btn");
  const formWrap = document.getElementById("form-wrap");
  const successWrap = document.getElementById("success-wrap");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    errorEl.classList.add("hidden");

    const email = emailInput.value.trim();

    if (!consentInput.checked) {
      errorEl.textContent = "Please tick the consent checkbox to continue.";
      errorEl.classList.remove("hidden");
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errorEl.textContent = "Please enter a valid email address.";
      errorEl.classList.remove("hidden");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Enlisting…";

    try {
      await submitToBackend({
        email: email.toLowerCase(),
        consent_given: true,
        created_at: new Date().toISOString(),
      });
      formWrap.classList.add("hidden");
      successWrap.classList.remove("hidden");
    } catch (err) {
      errorEl.textContent = "Something went wrong. Please try again.";
      errorEl.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = "Join the Waitlist";
    }
  });
}

document.addEventListener("DOMContentLoaded", initWaitlistForm);