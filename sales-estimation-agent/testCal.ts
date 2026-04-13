import { google } from 'googleapis';
import pricing from './src/config/pricing.js';

async function run() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  const cal = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const until = new Date(now.getTime() + 7 * 86400000);

  const res = await cal.events.list({
    calendarId: 'primary', timeMin: now.toISOString(), timeMax: until.toISOString(),
    singleEvents: true, orderBy: 'startTime',
  });

  console.log('Events found:', res.data.items?.length);
  res.data.items?.forEach(e => {
    console.log(e.summary, e.start?.dateTime, e.status);
  });
}
run().catch(console.error);
