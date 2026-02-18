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
- **HomePage**: Hero section, services overview, featured work, testimonials, CTA, **Instagram Recent Shoots** ✅
- **PortfolioPage**: Collage gallery with lightbox navigation (prev/next)
- **PricingPage**: Tabbed packages (12 total) with add-ons in ZAR
- **BookingPage**: Enhanced 3-step booking flow:
  - Step 1: Session type, package selection, **dynamic add-ons from API**
  - Step 2: Date/time selection with **weekend surcharge popup**
  - Step 3: Contact details with **full price breakdown**
- **AboutPage**: Photographer story, stats, philosophy
- **ContactPage**: Contact form, FAQ section
- **Admin Dashboard**:
  - Login/Authentication
  - Dashboard Home (stats overview)
  - Bookings Management (view, edit, filter by status)
  - Packages Management (CRUD operations)
  - **Add-ons Management** (CRUD with category filtering) ✅ NEW
  - Booking Settings (available days, time slots, buffer, lead time, blocked dates, weekend surcharge)
  - Calendar Sync (Apple Calendar settings UI - sync logic MOCKED)
  - Portfolio Management (**bulk upload with R2 support**) ✅ ENHANCED
  - Testimonials Management
  - Messages Management
  - **Email Templates** (visual + raw HTML editor, multiple template types) ✅ NEW
  - **Settings Page** (Cloudflare R2 storage, Instagram config) ✅ NEW

### Backend API Endpoints
- `/api/packages` - Get pricing packages
- `/api/admin/packages` - CRUD for packages
- `/api/addons` - Get active add-ons (filter by session_type) ✅ NEW
- `/api/admin/addons` - CRUD for add-ons ✅ NEW
- `/api/bookings` - Create bookings + email confirmation
- `/api/bookings/available-times` - Get available time slots
- `/api/admin/booking-settings` - GET/PUT booking configuration
- `/api/admin/calendar-settings` - GET/PUT calendar sync settings
- `/api/admin/calendar/sync` - Trigger calendar sync (MOCKED)
- `/api/admin/email-templates` - CRUD for email templates ✅ NEW
- `/api/admin/storage-settings` - GET/PUT R2 storage config ✅ NEW
- `/api/admin/instagram-settings` - GET/PUT Instagram config ✅ NEW
- `/api/instagram/feed` - Get Instagram posts for homepage ✅ NEW
- `/api/admin/upload-image` - Single image upload to R2 ✅ NEW
- `/api/admin/upload-images` - Multi-image upload to R2 ✅ NEW
- `/api/portfolio` - Get portfolio images
- `/api/testimonials` - Get approved testimonials
- `/api/contact` - Submit contact messages
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

### P1 (Next Priority - Blocked)
- [ ] Apple Calendar 2-way sync logic (BLOCKED - awaiting user's Apple ID credentials)
- [ ] Google Reviews integration (needs clarification - manual entry or automated widget?)

### P2 (Future)
- [ ] Image upload to cloud storage (currently URL-based)
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
- Apple Calendar sync logic is MOCKED - returns success but doesn't actually sync
- Content (logo, images, packages, testimonials) was scraped from silwerlining.co.za
- All prices are in ZAR (South African Rand)

## Test Reports
- /app/test_reports/iteration_3.json - 100% pass rate (Feb 2026)
