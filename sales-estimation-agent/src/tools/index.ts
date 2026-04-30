// src/tools/index.ts
// NOTE: LangChain's `tool()` uses deeply nested generics that trigger TS2589
// "Type instantiation is excessively deep" — this is a known false-positive.
// The server runs with --transpile-only so this never causes a runtime error.
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import pricing from '../../pricing.json';
import { kb } from '../services/knowledgeBase';

// ── Tool 1: Search Knowledge Base (Supabase pgvector RAG) ──────────────
export const searchKB = tool(
  async ({ query }) => {
    // Semantic search via Supabase
    const [allResults, projects] = await Promise.all([
      kb.searchAll(query),
      kb.searchProjects(query, 3),
    ]);

    if (allResults.length === 0 && projects.length === 0) {
      return JSON.stringify({
        results: [],
        note: 'No exact matches. Here are all services:',
        services: pricing.services.map(s => ({
          name: s.name, minPrice: s.minPrice, maxPrice: s.maxPrice,
          timeline: s.timeline, includes: s.includes,
        })),
      });
    }

    const response: any = {
      results: allResults.map(r => r.text),
      sources: [...new Set(allResults.map(r => r.source))],
    };

    // Add portfolio projects with URLs for credibility
    if (projects.length > 0) {
      response.projects = projects.map(p => ({
        name: p.name,
        description: p.description,
        cost: p.cost,
        timeline: p.timeline,
        impact: p.impact,
        url: p.live_url || null,
        category: p.category,
      }));
    }

    return JSON.stringify(response);
  },
  {
    name: 'search_knowledge_base',
    description: 'Search services, pricing, past projects, and docs using semantic search. ALWAYS call before building an estimate. Also returns matching portfolio projects with live URLs for credibility.',
    schema: z.object({ query: z.string().describe('Client requirement in detail') }),
  }
);

// ── Tool 2: Build Estimate ─────────────────────────────────────────────
export const buildEstimate = tool(
  async ({ services, notes }) => {
    const totalMin = services.reduce((s, i) => s + i.minPrice, 0);
    const totalMax = services.reduce((s, i) => s + i.maxPrice, 0);
    return JSON.stringify({
      items: services, totalMin, totalMax,
      currency: pricing.currency,
      timeline: services.map(s => s.timeline).join(', '),
      validDays: 30, notes: notes || '',
      policies: pricing.policies,
    });
  },
  {
    name: 'build_estimate',
    description: 'Build a structured cost estimate from matched services.',
    schema: z.object({
      services: z.array(z.object({
        name: z.string(), minPrice: z.number(), maxPrice: z.number(),
        timeline: z.string(), includes: z.array(z.string()),
      })),
      notes: z.string().optional(),
    }),
  }
);

// ── Tool 3: Get Calendar Slots ─────────────────────────────────────────
export const getSlots = tool(
  async ({ daysAhead }) => {
    const cfg = pricing.calendar;

    // Mock mode if no Google Calendar
    if (!process.env.GOOGLE_REFRESH_TOKEN) {
      const slots: any[] = [];
      const now = new Date();
      for (let i = 1; slots.length < 5 && i < 14; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        if (!cfg.workingDays.includes(d.getDay())) continue;
        for (const hour of [10, 12, 14, 16]) {
          if (slots.length >= 5) break;
          d.setHours(hour, 0, 0, 0);
          const end = new Date(d.getTime() + cfg.meetingDuration * 60000);
          slots.push({
            startTime: d.toISOString(),
            endTime: end.toISOString(),
            day: d.toLocaleString('en-IN', { timeZone: cfg.timezone, weekday: 'long' }),
            date: d.toLocaleString('en-IN', { timeZone: cfg.timezone, month: 'long', day: 'numeric' }),
            time: d.toLocaleString('en-IN', { timeZone: cfg.timezone, hour: 'numeric', minute: '2-digit', hour12: true }),
          });
        }
      }
      return JSON.stringify({ slots, mode: 'test' });
    }

    try {
      const { google } = await import('googleapis');
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI,
      );
      auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
      const cal = google.calendar({ version: 'v3', auth });

      const now = new Date();
      const until = new Date(now.getTime() + (daysAhead || 7) * 86400000);

      const res = await cal.events.list({
        calendarId: 'primary', timeMin: now.toISOString(), timeMax: until.toISOString(),
        singleEvents: true, orderBy: 'startTime',
      });

      const busy = (res.data.items || [])
        .filter((e: any) => e.start?.dateTime)
        .map((e: any) => ({ start: new Date(e.start.dateTime), end: new Date(e.end.dateTime) }));

      const slots: any[] = [];
      const cur = new Date(now);
      cur.setMinutes(Math.ceil(cur.getMinutes() / 30) * 30, 0, 0);

      while (cur < until && slots.length < 5) {
        const dow = cur.getDay();
        if (!cfg.workingDays.includes(dow)) { cur.setDate(cur.getDate() + 1); cur.setHours(cfg.workingHours.start, 0, 0, 0); continue; }
        if (cur.getHours() < cfg.workingHours.start) { cur.setHours(cfg.workingHours.start, 0, 0, 0); continue; }
        if (cur.getHours() >= cfg.workingHours.end) { cur.setDate(cur.getDate() + 1); cur.setHours(cfg.workingHours.start, 0, 0, 0); continue; }

        const endTime = new Date(cur.getTime() + cfg.meetingDuration * 60000);
        const buf = cfg.bufferMinutes * 60000;
        const conflict = busy.some((b: any) => new Date(cur.getTime() - buf) < b.end && new Date(endTime.getTime() + buf) > b.start);

        if (!conflict && cur > now) {
        slots.push({
          startTime: cur.toISOString(),
          endTime: endTime.toISOString(),
          day: cur.toLocaleString('en-IN', { timeZone: cfg.timezone, weekday: 'long' }),
          date: cur.toLocaleString('en-IN', { timeZone: cfg.timezone, month: 'long', day: 'numeric' }),
          time: cur.toLocaleString('en-IN', { timeZone: cfg.timezone, hour: 'numeric', minute: '2-digit', hour12: true }),
        });
        }
        cur.setMinutes(cur.getMinutes() + 30);
      }
      return JSON.stringify({ slots });
    } catch (err: any) {
      console.error('Calendar error:', err.message);
      return JSON.stringify({ error: 'Calendar unavailable', details: err.message });
    }
  },
  {
    name: 'get_calendar_slots',
    description: 'Get available meeting slots for a discovery call. Returns up to 5 options.',
    schema: z.object({ daysAhead: z.number().default(7).describe('Days ahead to search') }),
  }
);

// ── Tool 4: Create Booking ─────────────────────────────────────────────
export const createBooking = tool(
  async ({ startTime, clientName, clientEmail, summary }) => {
    if (!process.env.GOOGLE_REFRESH_TOKEN) {
      return JSON.stringify({
        success: true,
        message: `✅ Booking confirmed for ${clientName} at ${new Date(startTime).toLocaleString('en-IN', { timeZone: pricing.calendar.timezone, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}. (Test mode — no real event created)`,
        meetLink: '',
      });
    }
    try {
      const { google } = await import('googleapis');
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI,
      );
      auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
      const cal = google.calendar({ version: 'v3', auth });
      const cfg = pricing.calendar;

      const start = new Date(startTime);
      const end = new Date(start.getTime() + cfg.meetingDuration * 60000);

      const displayTime = start.toLocaleString('en-IN', {
        timeZone: cfg.timezone, weekday: 'long', month: 'long',
        day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
      });

      // Step 1: Create event WITH conference data request
      const event = await cal.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        sendUpdates: 'all',   // sends Google Calendar invite to all attendees automatically
        requestBody: {
          summary: `${cfg.meetingTitle} — ${clientName}`,
          description: `Discovery call details will be updated with Google Meet link shortly.\n\nClient: ${clientName}\nEmail: ${clientEmail}\n${summary ? '\nNotes: ' + summary : ''}`,
          start: { dateTime: start.toISOString(), timeZone: cfg.timezone },
          end: { dateTime: end.toISOString(), timeZone: cfg.timezone },
          attendees: clientEmail ? [{ email: clientEmail, displayName: clientName }] : [],
          conferenceData: {
            createRequest: {
              requestId: `ps-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
          reminders: {
            useDefault: false,
            overrides: [{ method: 'email', minutes: 60 }, { method: 'popup', minutes: 15 }],
          },
        },
      });

      // Step 2: Extract Meet link from conference data
      const meetLink: string =
        event.data.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri
        || (event.data as any).hangoutLink
        || '';

      console.log(`✅ Booking created. Event ID: ${event.data.id}, Meet link: ${meetLink}`);

      // Step 3: Update event description to include Meet link (so Google's email shows it)
      if (meetLink && event.data.id) {
        try {
          const updatedDescription = [
            `📅 ${cfg.meetingTitle}`,
            `👤 Client: ${clientName}`,
            `📧 Email: ${clientEmail}`,
            `⏰ Time: ${displayTime} (IST)`,
            `⌛ Duration: ${cfg.meetingDuration} minutes`,
            meetLink ? `\n🎥 Google Meet Link:\n${meetLink}` : '',
            summary ? `\n📝 Notes: ${summary}` : '',
          ].filter(Boolean).join('\n');

          await cal.events.patch({
            calendarId: 'primary',
            eventId: event.data.id,
            conferenceDataVersion: 1,
            sendUpdates: 'all',
            requestBody: { description: updatedDescription },
          });
          console.log('✅ Event description updated with Meet link');
        } catch (patchErr: any) {
          console.warn('Could not update description:', patchErr.message);
        }
      }

      // Step 4: Send confirmation email to the CLIENT via nodemailer (if configured)
      const smtpConfigured = process.env.SMTP_USER
        && process.env.SMTP_PASS
        && process.env.SMTP_PASS !== 'xxxx-xxxx-xxxx-xxxx'
        && process.env.SMTP_USER !== 'you@gmail.com';

      if (smtpConfigured && clientEmail) {
        try {
          const nm = await import('nodemailer');
          const transport = nm.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: false,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          });

          const html = `
            <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden">
              <div style="background:linear-gradient(135deg,#6366F1,#8B5CF6);padding:28px 32px;text-align:center">
                <h1 style="color:#fff;font-size:20px;margin:0">📅 Meeting Confirmed!</h1>
                <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px">${pricing.businessName}</p>
              </div>
              <div style="padding:28px 32px;background:#fff">
                <p style="font-size:15px;color:#111;margin-bottom:20px">Hi <strong>${clientName}</strong>,</p>
                <p style="color:#374151;font-size:14px;line-height:1.6">Your discovery call with <strong>${pricing.businessName}</strong> is confirmed! Here are your meeting details:</p>
                <div style="background:#f3f4f6;border-radius:10px;padding:20px;margin:20px 0">
                  <table style="width:100%;font-size:14px;color:#374151">
                    <tr><td style="padding:6px 0;color:#6B7280;width:120px">📅 Date & Time</td><td style="font-weight:600">${displayTime}</td></tr>
                    <tr><td style="padding:6px 0;color:#6B7280">⌛ Duration</td><td>${cfg.meetingDuration} minutes</td></tr>
                    ${meetLink ? `<tr><td style="padding:6px 0;color:#6B7280">🎥 Meet Link</td><td><a href="${meetLink}" style="color:#6366F1;font-weight:600">${meetLink}</a></td></tr>` : ''}
                  </table>
                </div>
                ${meetLink ? `<div style="text-align:center;margin:24px 0"><a href="${meetLink}" style="display:inline-block;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">🎥 Join Google Meet</a></div>` : ''}
                <p style="color:#6B7280;font-size:13px">You will also receive a Google Calendar invite with this link.<br>If you have any questions, just reply to this email.</p>
              </div>
              <div style="padding:16px;text-align:center;background:#f9f9f9;color:#9CA3AF;font-size:12px">${pricing.businessName} · ${pricing.tagline}</div>
            </div>`;

          await transport.sendMail({
            from: `${pricing.businessName} <${process.env.SMTP_USER}>`,
            to: `${clientName} <${clientEmail}>`,
            subject: `✅ Your Discovery Call is Confirmed — ${pricing.businessName}`,
            html,
            text: `Hi ${clientName},\n\nYour discovery call is confirmed!\n\nDate & Time: ${displayTime}\nDuration: ${cfg.meetingDuration} minutes\n${meetLink ? `Google Meet: ${meetLink}` : ''}\n\n${pricing.businessName}`,
          });
          console.log(`✅ Confirmation email sent to ${clientEmail}`);

          // Also notify business owner
          if (process.env.NOTIFY_EMAIL) {
            await transport.sendMail({
              from: `${pricing.businessName} <${process.env.SMTP_USER}>`,
              to: process.env.NOTIFY_EMAIL,
              subject: `🔔 New Booking: ${clientName} — ${displayTime}`,
              text: `New booking!\n\nClient: ${clientName}\nEmail: ${clientEmail}\nTime: ${displayTime}\nMeet: ${meetLink || 'N/A'}\n\n${summary || ''}`,
            });
          }
        } catch (emailErr: any) {
          console.warn('⚠️  Email send failed:', emailErr.message);
        }
      } else {
        console.log('ℹ️  SMTP not configured — skipping confirmation email. Google Calendar invite was sent instead.');
      }

      return JSON.stringify({
        success: true,
        link: event.data.htmlLink,
        meetLink,
        message: `✅ Discovery call booked! Calendar invite sent to ${clientEmail}.${meetLink ? ` Google Meet: ${meetLink}` : ''}`,
      });
    } catch (err: any) {
      console.error('Booking error:', err.message);
      return JSON.stringify({ success: false, message: `Booking failed: ${err.message}` });
    }
  },
  {
    name: 'create_booking',
    description: 'Create Google Calendar event with Google Meet link. Sends invite automatically.',
    schema: z.object({
      startTime: z.string().describe('Date and time of selected slot, e.g. "March 30 2026 12:00 PM +05:30"'),
      clientName: z.string().describe('Client full name'),
      clientEmail: z.string().email().describe('Client email'),
      summary: z.string().optional().describe('Brief call summary'),
    }),
  }
);

export const estimationTools = [searchKB, buildEstimate];
export const bookingTools = [getSlots, createBooking];

// ── Direct slot fetcher (no AI needed) — called by server when estimate is ready ──
export async function fetchAvailableSlots(daysAhead = 7): Promise<any[]> {
  const cfg = pricing.calendar;

  // Mock mode
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    const slots: any[] = [];
    const now = new Date();
    for (let i = 1; slots.length < 5 && i < 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      if (!cfg.workingDays.includes(d.getDay())) continue;
      for (const hour of [10, 12, 14, 16]) {
        if (slots.length >= 5) break;
        d.setHours(hour, 0, 0, 0);
        const end = new Date(d.getTime() + cfg.meetingDuration * 60000);
        slots.push({
          startTime: d.toISOString(),
          endTime: end.toISOString(),
          day: d.toLocaleString('en-IN', { timeZone: cfg.timezone, weekday: 'long' }),
          date: d.toLocaleString('en-IN', { timeZone: cfg.timezone, month: 'long', day: 'numeric' }),
          time: d.toLocaleString('en-IN', { timeZone: cfg.timezone, hour: 'numeric', minute: '2-digit', hour12: true }),
        });
      }
    }
    return slots;
  }

  try {
    const { google } = await import('googleapis');
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI,
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const cal = google.calendar({ version: 'v3', auth });

    const now = new Date();
    const until = new Date(now.getTime() + daysAhead * 86400000);

    const res = await cal.events.list({
      calendarId: 'primary', timeMin: now.toISOString(), timeMax: until.toISOString(),
      singleEvents: true, orderBy: 'startTime',
    });

    const busy = (res.data.items || [])
      .filter((e: any) => e.start?.dateTime)
      .map((e: any) => ({ start: new Date(e.start.dateTime), end: new Date(e.end.dateTime) }));

    const slots: any[] = [];
    const cur = new Date(now);
    cur.setMinutes(Math.ceil(cur.getMinutes() / 30) * 30, 0, 0);

    while (cur < until && slots.length < 5) {
      const dow = cur.getDay();
      if (!cfg.workingDays.includes(dow)) { cur.setDate(cur.getDate() + 1); cur.setHours(cfg.workingHours.start, 0, 0, 0); continue; }
      if (cur.getHours() < cfg.workingHours.start) { cur.setHours(cfg.workingHours.start, 0, 0, 0); continue; }
      if (cur.getHours() >= cfg.workingHours.end) { cur.setDate(cur.getDate() + 1); cur.setHours(cfg.workingHours.start, 0, 0, 0); continue; }

      const endTime = new Date(cur.getTime() + cfg.meetingDuration * 60000);
      const buf = cfg.bufferMinutes * 60000;
      const conflict = busy.some((b: any) => new Date(cur.getTime() - buf) < b.end && new Date(endTime.getTime() + buf) > b.start);

      if (!conflict && cur > now) {
        slots.push({
          startTime: cur.toISOString(),
          endTime: endTime.toISOString(),
          day: cur.toLocaleString('en-IN', { timeZone: cfg.timezone, weekday: 'long' }),
          date: cur.toLocaleString('en-IN', { timeZone: cfg.timezone, month: 'long', day: 'numeric' }),
          time: cur.toLocaleString('en-IN', { timeZone: cfg.timezone, hour: 'numeric', minute: '2-digit', hour12: true }),
        });
      }
      cur.setMinutes(cur.getMinutes() + 30);
    }
    return slots;
  } catch (err: any) {
    console.error('Slot fetch error:', err.message);
    return [];
  }
}
