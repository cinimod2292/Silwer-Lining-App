# Silwer Lining Photography - Product Requirements Document

## Original Problem Statement
Create a premium photography website for Silwer Lining Photography: a luxury brand that feels clean, warm, professional, and inviting. The website should showcase a beautifully curated portfolio with separate galleries for maternity, newborn, family, and individual portraits. Include a Pricing page with clear package details and add-ons. Build an integrated booking system that allows clients to select session types and dates and book directly through the website without using third-party plug-ins.

## User Choices
- Email confirmations via SendGrid
- No payment integration (handled offline)
- Skip shop section for now
- Full admin dashboard for bookings, portfolio, testimonials management
- Warm neutrals color palette (creams, beiges, soft golds)
- Admin experience similar to usesession.com

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + MongoDB
- **Email**: SendGrid for booking confirmations
- **Auth**: JWT-based admin authentication

## User Personas
1. **Expecting Mothers** - Looking for maternity photography sessions
2. **New Parents** - Seeking newborn photography
3. **Families** - Family portrait sessions
4. **Individuals** - Personal/professional portraits
5. **Admin** - Studio owner managing bookings and content

## Core Requirements
- [x] Portfolio with category filtering (maternity, newborn, family, individual)
- [x] Pricing packages with session type tabs
- [x] Integrated booking system with calendar
- [x] Email confirmations via SendGrid
- [x] Contact form
- [x] About page with photographer story
- [x] Testimonials section
- [x] Admin dashboard (bookings, portfolio, testimonials, messages)
- [x] Mobile-friendly responsive design
- [x] SEO optimized

## What's Been Implemented (Feb 2026)

### Frontend Pages
- **HomePage**: Hero section, services overview, featured work, testimonials, CTA, **Instagram Recent Shoots**, **Dynamic FAQs** ✅
- **PortfolioPage**: Collage gallery with lightbox navigation (prev/next)
- **PricingPage**: Tabbed packages (12 total) with add-ons in ZAR
- **BookingPage**: Enhanced booking flow with **dynamic questionnaire step**:
  - Step 1: Session type, package selection, **dynamic add-ons from API**
  - Step 2: Date/time selection with **weekend surcharge popup**
  - Step 3: **Questionnaire** (only if questionnaire exists for session type) ✅
  - Step 3/4: Contact details with **full price breakdown**
- **CompleteBookingPage**: Client-facing page for manual booking completion ✅ NEW
- **AboutPage**: Photographer story, stats, philosophy
- **ContactPage**: Contact form, **Dynamic FAQs** ✅
- **Admin Dashboard**:
  - Login/Authentication
  - Dashboard Home (stats overview)
  - **Calendar View** (FullCalendar with bookings, personal events, blocked slots) ✅ NEW
  - Bookings Management (view, edit, filter by status)
  - Packages Management (CRUD operations)
  - **Add-ons Management** (CRUD with category filtering) ✅
  - Booking Settings (available days, time slots, buffer, lead time, blocked dates, weekend surcharge)
  - Calendar Sync (Apple Calendar CalDAV with **2-way sync**) ✅ ENHANCED
  - Portfolio Management (**bulk upload with R2 support**) ✅
  - Testimonials Management
  - Messages Management
  - **Email Templates** (visual + raw HTML editor, multiple template types) ✅
  - **Settings Page** (Cloudflare R2 storage, Instagram config) ✅
  - **Questionnaires Management** (Google Forms-style builder) ✅
  - **FAQ Management** (CRUD with categories and ordering) ✅

### Backend API Endpoints
- `/api/packages` - Get pricing packages
- `/api/admin/packages` - CRUD for packages
- `/api/addons` - Get active add-ons (filter by session_type)
- `/api/admin/addons` - CRUD for add-ons
- `/api/bookings` - Create bookings + email confirmation (includes questionnaire responses)
- `/api/bookings/available-times` - Get available time slots (**with calendar blocking**) ✅
- `/api/admin/booking-settings` - GET/PUT booking configuration
- `/api/admin/calendar-settings` - GET/PUT calendar sync settings
- `/api/admin/calendar/sync` - Trigger calendar sync (**WORKING - CalDAV**) ✅
- `/api/admin/calendar/test` - Test Apple Calendar connection ✅ NEW
- `/api/admin/calendar/events` - Get calendar events for date (debug) ✅ NEW
- `/api/admin/calendar-view` - Get all events for calendar view ✅ NEW
- `/api/admin/blocked-slots` - CRUD for manually blocked time slots ✅ NEW
- `/api/admin/manual-booking` - Create manual booking with client link ✅ NEW
- `/api/booking-token/{token}` - Get/complete booking by token ✅ NEW
- `/api/admin/email-templates` - CRUD for email templates
- `/api/admin/storage-settings` - GET/PUT R2 storage config
- `/api/admin/instagram-settings` - GET/PUT Instagram config
- `/api/instagram/feed` - Get Instagram posts for homepage
- `/api/admin/upload-image` - Single image upload to R2
- `/api/admin/upload-images` - Multi-image upload to R2
- `/api/portfolio` - Get portfolio images
- `/api/testimonials` - Get approved testimonials
- `/api/contact` - Submit contact messages
- `/api/faqs` - Get active FAQs (public)
- `/api/admin/faqs` - CRUD for FAQs
- `/api/questionnaire/{session_type}` - Get questionnaire for booking
- `/api/admin/questionnaires` - CRUD for questionnaires
- `/api/admin/*` - Protected admin routes (login, CRUD operations, stats)

### Design Features
- Playfair Display + Manrope typography
- Warm neutral palette (#FDFCF8, #C6A87C, #2D2A26)
- Glassmorphism navigation
- Smooth animations and hover effects

## Prioritized Backlog

### P0 (Completed)
- [x] Core booking system
- [x] Portfolio galleries
- [x] Admin dashboard
- [x] Email confirmations
- [x] Packages management in admin
- [x] Booking settings configuration
- [x] Calendar sync UI
- [x] FAQ management with dynamic display ✅
- [x] Questionnaire integration in booking flow ✅
- [x] Apple Calendar 2-way sync (CalDAV) ✅
- [x] Admin Calendar View (FullCalendar) ✅
- [x] Manual Booking Flow with client completion link ✅
- [x] Block/Unblock time slots ✅
- [x] Simplified Booking Settings (removed Available Days checkboxes & Default Session Duration) ✅
- [x] Multi-day calendar event blocking (properly blocks availability when events span multiple days) ✅
- [x] **Contract Signing System** ✅ NEW
  - Admin contract editor with smart field builder
  - Smart field types: Agree/Disagree, Initials, Signature (draw), Date (auto-filled)
  - Contract step in booking flow (required before final confirmation)
  - PDF generation with weasyprint
  - Contract PDF emailed to client + CC to admin

### P1 (Next Priority)
- [ ] Test Cloudflare R2 Portfolio Upload (credentials configured, needs end-to-end test)
- [ ] Google Reviews integration (needs clarification - manual entry or automated widget?)

### P2 (Future)
- [ ] SEO meta tags per page
- [ ] Google Analytics integration
- [ ] Shop section for sublimation/personalized gifts
- [ ] WhatsApp "Book Now" button
- [ ] PayFlex integration

### P3 (Nice to Have)
- [ ] Client portal for viewing/downloading photos
- [ ] Gift cards/vouchers
- [ ] Blog for SEO content
- [ ] Multi-language support

## Admin Credentials (for testing)
- Email: admin@silwerlining.com
- Password: Admin123!

## Notes
- Apple Calendar 2-way sync is now FULLY WORKING via CalDAV
- Cloudflare R2 portfolio uploads are ready but need user to test
- Content (logo, images, packages, testimonials) was scraped from silwerlining.co.za
- All prices are in ZAR (South African Rand)
- Questionnaire data: Maternity session has active questionnaire with 4 questions
- Manual booking tokens expire after 7 days
- **Booking availability now derived from time_slot_schedule** - a day is available if ANY session type has time slots configured for that day

## Test Reports
- /app/test_reports/iteration_3.json - 100% pass rate (Feb 2026)
- /app/test_reports/iteration_4.json - Previous testing
- /app/test_reports/iteration_5.json - FAQ & Questionnaire features (100% pass)
- /app/test_reports/iteration_6.json - Calendar View & Manual Booking (100% pass)
- /app/test_reports/iteration_7.json - Booking Settings Simplification (100% pass) ✅ NEW
