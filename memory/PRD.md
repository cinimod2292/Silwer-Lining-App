# Silwer Lining Photography - Product Requirements Document

## Original Problem Statement
Build a premium photography website for "Silwer Lining Photography" with portfolio showcase, pricing, integrated booking system, About Me section, testimonials, and contact info. Evolved into a full business management platform.

## Core Requirements
- **Public Website**: Portfolio, pricing, testimonials, about, contact, booking flow
- **Admin Dashboard**: Manage bookings, portfolio, testimonials, pricing, add-ons, FAQs, booking settings, email templates, contracts, payments
- **Contract System**: WYSIWYG editor with smart fields (signature, initials, agree/disagree, date). Clients sign during booking.
- **Payment System**: PayFast integration with sandbox/live toggle. Payflex placeholder.
- **Client Booking Management**: Unique link for clients to manage sessions (reschedule, cancel, questionnaire)
- **Automated Reminders**: Admin UI for email reminder rules (cron job pending)
- **Email Provider**: Admin can switch between SendGrid and Microsoft Graph API
- **Google Reviews**: Fetch from Google Places API with manual entry fallback
- **Session Questionnaire**: Presented after payment, completable later via emailed link

## Tech Stack
- **Frontend**: React, Tailwind CSS, Shadcn/UI, TipTap (ProseMirror), react-signature-canvas
- **Backend**: FastAPI (monolithic server.py), MongoDB
- **Integrations**: SendGrid, Instagram Graph API, Cloudflare R2, CalDAV, PayFast, Google Places API, Microsoft Graph API (pending credentials)

## Key DB Collections
- **bookings**: manage_token, questionnaire_completed_at
- **settings**: payment_settings (live/sandbox PayFast creds), email_settings (provider, MS Graph/SendGrid creds), google_review_settings (API key, Place ID)
- **automated_reminders**: template_id, days_before, status
- **testimonials**: source (manual/google), rating, review_url

## Admin Credentials
- Email: admin@silwerlining.com
- Password: Admin123!

## What's Been Implemented
- Full public website with all pages
- Complete admin dashboard with all management pages
- Multi-step booking flow with contract signing
- PayFast payment integration (sandbox + live toggle)
- Client booking management portal (/manage/:token)
- Automated reminders admin UI
- Email provider switching UI (SendGrid/MS Graph)
- Google Reviews integration (manual + API fetch)
- Questionnaire flow (post-payment)
- CalDAV calendar sync
- Portfolio & testimonial management
- Contract editor with WYSIWYG + smart fields (FIXED: insertion stability, initials formatting, visual prominence)

## Pending/Upcoming
- P1: Microsoft Graph API - needs user credentials (Client ID, Tenant ID, Client Secret, Sender Email)
- P2: Cron job for automated reminders (UI exists, scheduler not implemented)
- P2: Google Reviews API end-to-end testing (needs valid credentials)

## Future/Backlog
- Payflex payment integration (UI mocked, no backend)
- Shop/E-commerce section
- Refactor monolithic server.py into modular FastAPI routers

## Recent Changes (2025-02-22)
- Fixed: Smart fields no longer disappear in admin contract editor after insertion (removed duplicate content-fetching useEffect, used ref-based approach)
- Fixed: Initials smart field on client contract shows only input with "Initial" placeholder (removed Label heading)
- Fixed: All smart fields now visually stand out with colored backgrounds and borders (amber for agree/initials, blue for date, purple for signature)
