# Silwer Lining Photography - Product Requirements Document

## Original Problem Statement
Build a premium photography website for "Silwer Lining Photography" with portfolio showcase, pricing, integrated booking system, About Me section, testimonials, and contact info. Evolved into a full business management platform.

## Core Requirements
- **Public Website**: Portfolio, pricing, testimonials, about, contact, booking flow
- **Admin Dashboard**: Manage bookings, portfolio, testimonials, pricing, add-ons, FAQs, booking settings, email templates, contracts, payments
- **Contract System**: WYSIWYG editor with smart fields (signature, initials, agree/disagree, date). Clients sign during booking.
- **Payment System**: PayFast integration with sandbox/live toggle. Payflex placeholder.
- **Client Booking Management**: Unique link for clients to manage sessions (reschedule, cancel, questionnaire)
- **Automated Reminders**: Admin UI for email reminder rules + background scheduler (cron job)
- **Email Provider**: Admin can switch between SendGrid and Microsoft Graph API
- **Google Reviews**: Fetch from Google Places API with manual entry fallback
- **Session Questionnaire**: Presented after payment, completable later via emailed link

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn/UI, TipTap (ProseMirror), react-signature-canvas
- **Backend**: FastAPI (modular router architecture), MongoDB
- **Integrations**: SendGrid, Instagram Graph API, Cloudflare R2, CalDAV, PayFast, Google Places API, Microsoft Graph API

## Architecture
```
/app/backend/
├── server.py          # Slim entrypoint (~50 lines) - includes all routers
├── db.py              # MongoDB connection, config constants
├── auth.py            # JWT auth (hash, verify, create/verify token)
├── models.py          # All Pydantic models
├── routes/
│   ├── admin.py       # All admin CRUD endpoints
│   ├── public.py      # Public endpoints (packages, portfolio, booking, available-dates)
│   ├── client.py      # Client booking management endpoints
│   ├── payments.py    # PayFast ITN, payment initiation/verification
│   └── reminders.py   # Automated reminders CRUD + background scheduler
├── services/
│   ├── email.py       # SendGrid + Microsoft Graph email sending
│   ├── payments.py    # PayFast credential management + signature calc
│   ├── calendar.py    # CalDAV integration + calendar cache
│   └── contracts.py   # Contract PDF generation (WeasyPrint)
```

## Key DB Collections
- **bookings**: manage_token, questionnaire_completed_at, contract_data
- **packages**, **portfolio**, **testimonials**, **faqs**, **addons**, **questionnaires**
- **settings**: payment_settings, email_settings, booking_settings, calendar_settings, storage_settings, instagram_settings, google_reviews_settings
- **automated_reminders**: template_id, days_before, status
- **contract_template**: WYSIWYG content with smart fields
- **admins**, **contact_messages**, **email_templates**
- **calendar_events_cache**: Cached CalDAV events for fast availability lookups

## Admin Credentials
- Email: admin@silwerlining.com
- Password: Admin123!

## What's Been Implemented
- Full public website with all pages
- Complete admin dashboard with all management pages
- Multi-step booking flow with contract signing
- PayFast payment integration (sandbox + live toggle)
- Client booking management portal (/manage/:token)
- Automated reminders admin UI + background scheduler (cron job, 10-min interval)
- Email provider switching UI (SendGrid/MS Graph)
- Google Reviews integration (manual + API fetch)
- Questionnaire flow (post-payment)
- CalDAV calendar sync
- Portfolio & testimonial management
- Contract editor with WYSIWYG + smart fields
- **Backend refactoring**: Monolithic 4364-line server.py → modular FastAPI routers (COMPLETED Feb 2026)
- **Calendar availability optimization**: Bulk month availability endpoint, CalDAV event caching, green dot indicators on available dates, instant time slot rendering (COMPLETED Feb 2026)

## Pending/Upcoming
- P1: Google Reviews API end-to-end testing (needs valid credentials from user)
- P2: Microsoft Graph API verification (user reports working)

## Future/Backlog
- Payflex payment integration (UI mocked, no backend)
- Shop/E-commerce section for selling gifts
