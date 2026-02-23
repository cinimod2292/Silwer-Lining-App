import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, UploadFile, File
from fastapi.responses import Response
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import httpx
from db import db, SENDGRID_API_KEY, SENDER_EMAIL, logger
from auth import verify_token, hash_password, verify_password, create_token
from models import (
    AdminLogin, AdminCreate, PackageCreate, Package, BookingSettingsUpdate, BookingSettings,
    BookingUpdate, Booking, ManualBookingCreate, ManualBookingToken, BlockedSlot, CustomSlot,
    PortfolioCreate, Portfolio, TestimonialCreate, Testimonial,
    FAQCreate, FAQ, AddOnCreate, AddOn,
    EmailTemplateCreate, EmailTemplate, StorageSettingsUpdate, InstagramSettingsUpdate,
    QuestionnaireCreate, Questionnaire, PaymentSettings
)
from routes.public import get_default_packages
from services.email import send_booking_confirmation_email, send_manual_booking_email, send_email
from services.contracts import generate_contract_pdf
from services.calendar import (
    get_caldav_client, get_all_caldav_calendars, get_events_from_all_calendars,
    create_calendar_event, get_booking_calendar, parse_time_slot, delete_calendar_event
)

router = APIRouter()


# ==================== ADMIN AUTH ====================

@router.post("/admin/login")
async def admin_login(data: AdminLogin):
    admin = await db.admins.find_one({"email": data.email}, {"_id": 0})
    if not admin or not verify_password(data.password, admin["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(data.email)
    return {"token": token, "name": admin["name"], "email": admin["email"]}

@router.post("/admin/setup")
async def setup_admin(data: AdminCreate):
    existing = await db.admins.find_one()
    if existing:
        raise HTTPException(status_code=400, detail="Admin already exists")
    admin_doc = {
        "id": str(uuid.uuid4()), "email": data.email,
        "password": hash_password(data.password), "name": data.name,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.admins.insert_one(admin_doc)
    return {"message": "Admin created successfully"}

@router.get("/admin/me")
async def get_current_admin(admin=Depends(verify_token)):
    return {"name": admin["name"], "email": admin["email"]}


# ==================== ADMIN - STATS ====================

@router.get("/admin/stats")
async def admin_get_stats(admin=Depends(verify_token)):
    total_bookings = await db.bookings.count_documents({})
    pending_bookings = await db.bookings.count_documents({"status": "pending"})
    portfolio_count = await db.portfolio.count_documents({})
    testimonials_count = await db.testimonials.count_documents({"approved": True})
    unread_messages = await db.contact_messages.count_documents({"read": False})
    return {
        "total_bookings": total_bookings, "pending_bookings": pending_bookings,
        "confirmed_bookings": await db.bookings.count_documents({"status": "confirmed"}),
        "completed_bookings": await db.bookings.count_documents({"status": "completed"}),
        "portfolio_count": portfolio_count, "testimonials_count": testimonials_count,
        "unread_messages": unread_messages,
        "packages_count": await db.packages.count_documents({"active": True})
    }


# ==================== ADMIN - PACKAGES ====================

@router.get("/admin/packages")
async def admin_get_packages(admin=Depends(verify_token)):
    packages = await db.packages.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    if not packages:
        defaults = get_default_packages()
        for pkg in defaults:
            pkg["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.packages.insert_one(pkg)
        packages = defaults
    return packages

@router.post("/admin/packages")
async def admin_create_package(data: PackageCreate, admin=Depends(verify_token)):
    max_order_item = await db.packages.find_one(sort=[("order", -1)])
    max_order = max_order_item["order"] + 1 if max_order_item else 0
    package = Package(**data.model_dump(), order=max_order)
    await db.packages.insert_one(package.model_dump())
    return package

@router.put("/admin/packages/{package_id}")
async def admin_update_package(package_id: str, data: PackageCreate, admin=Depends(verify_token)):
    update_data = data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.packages.update_one({"id": package_id}, {"$set": update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    return {"message": "Package updated"}

@router.delete("/admin/packages/{package_id}")
async def admin_delete_package(package_id: str, admin=Depends(verify_token)):
    result = await db.packages.delete_one({"id": package_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    return {"message": "Package deleted"}


# ==================== ADMIN - BOOKING SETTINGS ====================

@router.get("/admin/booking-settings")
async def admin_get_booking_settings(admin=Depends(verify_token)):
    settings = await db.booking_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        settings = BookingSettings().model_dump()
        await db.booking_settings.insert_one(settings)
    return settings

@router.put("/admin/booking-settings")
async def admin_update_booking_settings(data: BookingSettingsUpdate, admin=Depends(verify_token)):
    await db.booking_settings.update_one({"id": "default"}, {"$set": data.model_dump()}, upsert=True)
    return {"message": "Settings updated"}


# ==================== ADMIN - BOOKINGS ====================

@router.get("/admin/bookings")
async def admin_get_bookings(admin=Depends(verify_token), status: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    if date_from:
        query["booking_date"] = {"$gte": date_from}
    if date_to:
        if "booking_date" in query:
            query["booking_date"]["$lte"] = date_to
        else:
            query["booking_date"] = {"$lte": date_to}
    return await db.bookings.find(query, {"_id": 0}).sort("booking_date", -1).to_list(500)

@router.get("/admin/bookings/{booking_id}")
async def admin_get_booking(booking_id: str, admin=Depends(verify_token)):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking

@router.put("/admin/bookings/{booking_id}")
async def admin_update_booking(booking_id: str, data: BookingUpdate, admin=Depends(verify_token)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Check if date or time changed — if so, remove old calendar event and create new one
    date_or_time_changed = "booking_date" in update_data or "booking_time" in update_data
    old_booking = None
    if date_or_time_changed:
        old_booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})

    result = await db.bookings.update_one({"id": booking_id}, {"$set": update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")

    if date_or_time_changed and old_booking:
        # Delete old calendar event
        old_uid = old_booking.get("calendar_event_id")
        if old_uid:
            await delete_calendar_event(old_uid)
        # Create new calendar event with updated booking
        updated_booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
        if updated_booking:
            new_uid = await create_calendar_event(updated_booking)
            if new_uid:
                await db.bookings.update_one({"id": booking_id}, {"$set": {"calendar_event_id": new_uid}})

    return {"message": "Booking updated"}

@router.delete("/admin/bookings/{booking_id}")
async def admin_delete_booking(booking_id: str, admin=Depends(verify_token)):
    # Get booking first to find calendar event ID
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Delete from calendar
    event_uid = booking.get("calendar_event_id")
    if event_uid:
        await delete_calendar_event(event_uid)

    await db.bookings.delete_one({"id": booking_id})
    return {"message": "Booking deleted"}


# ==================== ADMIN - CALENDAR VIEW ====================

@router.get("/admin/calendar-view")
async def admin_get_calendar_view(start_date: str, end_date: str, admin=Depends(verify_token)):
    events = []
    booking_settings = await db.booking_settings.find_one({"id": "default"}, {"_id": 0})
    if not booking_settings:
        booking_settings = {"time_slots": ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"], "available_days": [1,2,3,4,5]}

    bookings = await db.bookings.find({"booking_date": {"$gte": start_date, "$lte": end_date}, "status": {"$nin": ["cancelled"]}}, {"_id": 0}).to_list(500)
    booked_slots = {}
    for booking in bookings:
        key = f"{booking['booking_date']}_{booking['booking_time']}"
        booked_slots[key] = booking
        hour, minute = parse_time_slot(booking["booking_time"])
        if hour is not None:
            start_dt = f"{booking['booking_date']}T{hour:02d}:{minute:02d}:00"
            end_dt = f"{booking['booking_date']}T{hour+2:02d}:{minute:02d}:00"
        else:
            start_dt = f"{booking['booking_date']}T09:00:00"
            end_dt = f"{booking['booking_date']}T11:00:00"
        status_colors = {"pending": "#F59E0B", "confirmed": "#10B981", "completed": "#6B7280", "awaiting_client": "#8B5CF6"}
        events.append({
            "id": f"booking-{booking['id']}", "title": f"\U0001f4f8 {booking['client_name']} - {booking['session_type'].title()}",
            "start": start_dt, "end": end_dt,
            "backgroundColor": status_colors.get(booking["status"], "#C6A87C"),
            "borderColor": status_colors.get(booking["status"], "#C6A87C"),
            "extendedProps": {"type": "booking", "bookingId": booking["id"], "status": booking["status"],
                              "clientName": booking["client_name"], "clientEmail": booking["client_email"],
                              "clientPhone": booking["client_phone"], "sessionType": booking["session_type"],
                              "packageName": booking["package_name"], "totalPrice": booking.get("total_price", 0)}
        })

    blocked_slots = await db.blocked_slots.find({"date": {"$gte": start_date, "$lte": end_date}}, {"_id": 0}).to_list(500)
    for slot in blocked_slots:
        hour, minute = parse_time_slot(slot["time"])
        if hour is not None:
            start_dt = f"{slot['date']}T{hour:02d}:{minute:02d}:00"
            end_dt = f"{slot['date']}T{hour+2:02d}:{minute:02d}:00"
        else:
            start_dt = f"{slot['date']}T09:00:00"
            end_dt = f"{slot['date']}T11:00:00"
        events.append({
            "id": f"blocked-{slot['id']}", "title": f"\U0001f6ab {slot.get('reason', 'Blocked')}",
            "start": start_dt, "end": end_dt, "backgroundColor": "#EF4444", "borderColor": "#EF4444",
            "extendedProps": {"type": "blocked", "slotId": slot["id"], "reason": slot.get("reason", "Blocked")}
        })

    # CalDAV events
    settings = await db.calendar_settings.find_one({"id": "default"})
    calendar_blocked = {}
    if settings and settings.get("sync_enabled"):
        try:
            start_dt_obj = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            end_dt_obj = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, tzinfo=timezone.utc)
            cal_events = await get_events_from_all_calendars(start_dt_obj, end_dt_obj)
            for cal_event in cal_events:
                events.append({
                    "id": f"personal-{uuid.uuid4()}", "title": f"\U0001f512 {cal_event['summary']} ({cal_event['calendar_name']})",
                    "start": cal_event["start"], "end": cal_event["end"],
                    "backgroundColor": "#64748B", "borderColor": "#64748B",
                    "extendedProps": {"type": "personal", "summary": cal_event["summary"], "calendarName": cal_event["calendar_name"]}
                })
            # Build calendar_blocked dict for open slot generation
            for evt in cal_events:
                try:
                    evt_start = datetime.fromisoformat(evt["start"].replace("Z", "+00:00"))
                    evt_end = datetime.fromisoformat(evt["end"].replace("Z", "+00:00"))
                    current_date = evt_start.date()
                    end_date_obj = evt_end.date()
                    while current_date <= end_date_obj:
                        date_str = current_date.strftime("%Y-%m-%d")
                        if date_str not in calendar_blocked:
                            calendar_blocked[date_str] = []
                        if current_date == evt_start.date() and current_date == evt_end.date():
                            bsh, bsm, beh, bem = evt_start.hour, evt_start.minute, evt_end.hour, evt_end.minute
                        elif current_date == evt_start.date():
                            bsh, bsm, beh, bem = evt_start.hour, evt_start.minute, 23, 59
                        elif current_date == evt_end.date():
                            bsh, bsm, beh, bem = 0, 0, evt_end.hour, evt_end.minute
                        else:
                            bsh, bsm, beh, bem = 0, 0, 23, 59
                        calendar_blocked[date_str].append({"start_hour": bsh, "start_min": bsm, "end_hour": beh, "end_min": bem})
                        current_date += timedelta(days=1)
                except:
                    pass
        except Exception as e:
            logger.error(f"Failed to fetch calendar events: {e}")

    # Open slots
    blocked_slots_db = await db.blocked_slots.find({"date": {"$gte": start_date, "$lte": end_date}}, {"_id": 0}).to_list(500)
    blocked_set = {f"{s['date']}_{s['time']}" for s in blocked_slots_db}
    custom_slots_db = await db.custom_slots.find({"date": {"$gte": start_date, "$lte": end_date}}, {"_id": 0}).to_list(500)
    custom_slots_dict = {f"{s['date']}_{s['time']}": s for s in custom_slots_db}

    def is_cal_blocked(date_str, hour, minute):
        if date_str not in calendar_blocked:
            return False
        slot_start = hour * 60 + minute
        slot_end = (hour + 2) * 60 + minute
        for ce in calendar_blocked[date_str]:
            es = ce["start_hour"] * 60 + ce["start_min"]
            ee = ce["end_hour"] * 60 + ce["end_min"]
            if not (slot_end <= es or slot_start >= ee):
                return True
        return False

    # Custom slots
    for slot_key, slot_data in custom_slots_dict.items():
        date_str, time_slot = slot_data["date"], slot_data["time"]
        if slot_key in booked_slots or slot_key in blocked_set:
            continue
        hour, minute = parse_time_slot(time_slot)
        if hour is None or is_cal_blocked(date_str, hour, minute):
            continue
        events.append({
            "id": f"open-{date_str}-{time_slot}", "title": "\u2705 Available",
            "start": f"{date_str}T{hour:02d}:{minute:02d}:00", "end": f"{date_str}T{hour+2:02d}:{minute:02d}:00",
            "backgroundColor": "#22C55E", "borderColor": "#22C55E", "display": "block",
            "extendedProps": {"type": "open", "date": date_str, "time": time_slot, "isCustom": True}
        })

    # Regular schedule slots
    time_slot_schedule = booking_settings.get("time_slot_schedule", {})
    all_available_slots_by_day = {}
    for session_type, days_dict in time_slot_schedule.items():
        for day_id_str, day_slots in days_dict.items():
            day_id = int(day_id_str)
            if day_id not in all_available_slots_by_day:
                all_available_slots_by_day[day_id] = set()
            all_available_slots_by_day[day_id].update(day_slots)

    current = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        day_id = (current.weekday() + 1) % 7
        for time_slot in sorted(all_available_slots_by_day.get(day_id, set())):
            slot_key = f"{date_str}_{time_slot}"
            if slot_key in booked_slots or slot_key in blocked_set or slot_key in custom_slots_dict:
                continue
            hour, minute = parse_time_slot(time_slot)
            if hour is None or is_cal_blocked(date_str, hour, minute):
                continue
            events.append({
                "id": f"open-{date_str}-{time_slot}", "title": "\u2705 Available",
                "start": f"{date_str}T{hour:02d}:{minute:02d}:00", "end": f"{date_str}T{hour+2:02d}:{minute:02d}:00",
                "backgroundColor": "#22C55E", "borderColor": "#22C55E", "display": "block",
                "extendedProps": {"type": "open", "date": date_str, "time": time_slot}
            })
        current += timedelta(days=1)

    return {"events": events}


# ==================== ADMIN - BLOCKED/CUSTOM SLOTS ====================

@router.post("/admin/blocked-slots")
async def admin_create_blocked_slot(data: dict, admin=Depends(verify_token)):
    slot = BlockedSlot(date=data["date"], time=data["time"], reason=data.get("reason", "Blocked by admin"))
    await db.blocked_slots.insert_one(slot.model_dump())
    return {"message": "Slot blocked", "id": slot.id}

@router.delete("/admin/blocked-slots/{slot_id}")
async def admin_delete_blocked_slot(slot_id: str, admin=Depends(verify_token)):
    result = await db.blocked_slots.delete_one({"id": slot_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blocked slot not found")
    return {"message": "Slot unblocked"}

@router.post("/admin/custom-slots")
async def admin_create_custom_slot(data: dict, admin=Depends(verify_token)):
    slot = CustomSlot(date=data["date"], time=data["time"])
    existing = await db.custom_slots.find_one({"date": data["date"], "time": data["time"]})
    if existing:
        raise HTTPException(status_code=400, detail="This time slot already exists")
    await db.custom_slots.insert_one(slot.model_dump())
    return {"message": "Time slot added", "id": slot.id}

@router.delete("/admin/custom-slots/{slot_id}")
async def admin_delete_custom_slot(slot_id: str, admin=Depends(verify_token)):
    result = await db.custom_slots.delete_one({"id": slot_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom slot not found")
    return {"message": "Time slot removed"}


# ==================== MANUAL BOOKING ====================

@router.post("/admin/manual-booking")
async def admin_create_manual_booking(data: ManualBookingCreate, background_tasks: BackgroundTasks, admin=Depends(verify_token)):
    booking = Booking(client_name=data.client_name, client_email=data.client_email, client_phone=data.client_phone,
                      session_type=data.session_type, package_id="pending", package_name="To be selected",
                      package_price=0, booking_date=data.booking_date, booking_time=data.booking_time,
                      notes=data.notes, status="awaiting_client")
    await db.bookings.insert_one(booking.model_dump())
    token = ManualBookingToken(booking_id=booking.id, expires_at=(datetime.now(timezone.utc) + timedelta(days=7)).isoformat())
    await db.booking_tokens.insert_one(token.model_dump())
    background_tasks.add_task(send_manual_booking_email, booking.model_dump(), token.token)
    return {"message": "Manual booking created", "booking_id": booking.id, "token": token.token, "booking_link": f"/complete-booking/{token.token}"}


# ==================== ADMIN - PORTFOLIO ====================

@router.get("/admin/portfolio")
async def admin_get_portfolio(admin=Depends(verify_token)):
    return await db.portfolio.find({}, {"_id": 0}).sort("order", 1).to_list(200)

@router.post("/admin/portfolio")
async def admin_create_portfolio(data: PortfolioCreate, admin=Depends(verify_token)):
    max_order_item = await db.portfolio.find_one(sort=[("order", -1)])
    item = Portfolio(**data.model_dump(), order=(max_order_item["order"] + 1 if max_order_item else 0))
    await db.portfolio.insert_one(item.model_dump())
    return item

@router.put("/admin/portfolio/{item_id}")
async def admin_update_portfolio(item_id: str, data: PortfolioCreate, admin=Depends(verify_token)):
    result = await db.portfolio.update_one({"id": item_id}, {"$set": data.model_dump()})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Portfolio item updated"}

@router.delete("/admin/portfolio/{item_id}")
async def admin_delete_portfolio(item_id: str, admin=Depends(verify_token)):
    result = await db.portfolio.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Portfolio item deleted"}


# ==================== ADMIN - TESTIMONIALS ====================

@router.get("/admin/testimonials")
async def admin_get_testimonials(admin=Depends(verify_token)):
    return await db.testimonials.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)

@router.post("/admin/testimonials")
async def admin_create_testimonial(data: TestimonialCreate, admin=Depends(verify_token)):
    item = Testimonial(**data.model_dump(), approved=True)
    await db.testimonials.insert_one(item.model_dump())
    return item

@router.put("/admin/testimonials/{item_id}")
async def admin_update_testimonial(item_id: str, approved: bool, admin=Depends(verify_token)):
    result = await db.testimonials.update_one({"id": item_id}, {"$set": {"approved": approved}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    return {"message": "Testimonial updated"}

@router.delete("/admin/testimonials/{item_id}")
async def admin_delete_testimonial(item_id: str, admin=Depends(verify_token)):
    result = await db.testimonials.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    return {"message": "Testimonial deleted"}


# ==================== ADMIN - GOOGLE REVIEWS ====================

@router.get("/admin/google-reviews/settings")
async def get_google_reviews_settings(admin=Depends(verify_token)):
    settings = await db.google_reviews_settings.find_one({"id": "default"}, {"_id": 0})
    return settings or {}

@router.put("/admin/google-reviews/settings")
async def save_google_reviews_settings(data: dict, admin=Depends(verify_token)):
    await db.google_reviews_settings.update_one(
        {"id": "default"},
        {"$set": {"id": "default", "enabled": data.get("enabled", False), "api_key": data.get("api_key", ""),
                   "place_id": data.get("place_id", ""), "auto_fetch": data.get("auto_fetch", False),
                   "fetch_frequency": data.get("fetch_frequency", "daily"), "last_fetched": data.get("last_fetched"),
                   "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True)
    return {"message": "Settings saved"}

@router.post("/admin/google-reviews/fetch")
async def fetch_google_reviews(admin=Depends(verify_token)):
    settings = await db.google_reviews_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings or not settings.get("enabled"):
        raise HTTPException(status_code=400, detail="Google Reviews not enabled")
    api_key, place_id = settings.get("api_key"), settings.get("place_id")
    if not api_key or not place_id:
        raise HTTPException(status_code=400, detail="API key and Place ID required")

    try:
        url = "https://maps.googleapis.com/maps/api/place/details/json"
        params = {"place_id": place_id, "fields": "reviews,rating,user_ratings_total", "key": api_key}
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(url, params=params, timeout=10.0)
            data = response.json()
        if data.get("status") != "OK":
            raise HTTPException(status_code=400, detail=f"Google API error: {data.get('error_message', data.get('status'))}")
        reviews = data.get("result", {}).get("reviews", [])[:5]
        count = 0
        for review in reviews:
            review_id = f"google_{review.get('time', '')}"
            existing = await db.testimonials.find_one({"id": review_id})
            if existing:
                continue
            await db.testimonials.insert_one({
                "id": review_id, "source": "google", "client_name": review.get("author_name", "Google User"),
                "author_name": review.get("author_name", ""), "profile_photo_url": review.get("profile_photo_url", ""),
                "rating": review.get("rating", 5), "content": review.get("text", ""), "text": review.get("text", ""),
                "relative_time_description": review.get("relative_time_description", ""),
                "time": review.get("time", 0), "session_type": "google", "approved": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            count += 1
        await db.google_reviews_settings.update_one({"id": "default"}, {"$set": {"last_fetched": datetime.now(timezone.utc).isoformat()}})
        return {"count": count, "message": f"Fetched {count} new reviews"}
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to Google: {str(e)}")


# ==================== ADMIN - MESSAGES ====================

@router.get("/admin/messages")
async def admin_get_messages(admin=Depends(verify_token)):
    return await db.contact_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)

@router.put("/admin/messages/{message_id}")
async def admin_mark_read(message_id: str, admin=Depends(verify_token)):
    result = await db.contact_messages.update_one({"id": message_id}, {"$set": {"read": True}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"message": "Message marked as read"}

@router.delete("/admin/messages/{message_id}")
async def admin_delete_message(message_id: str, admin=Depends(verify_token)):
    result = await db.contact_messages.delete_one({"id": message_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"message": "Message deleted"}


# ==================== ADMIN - EMAIL SETTINGS ====================

@router.get("/admin/email-settings")
async def get_email_settings(admin=Depends(verify_token)):
    settings = await db.email_settings.find_one({"id": "default"}, {"_id": 0})
    return settings or {}

@router.put("/admin/email-settings")
async def save_email_settings(data: dict, admin=Depends(verify_token)):
    await db.email_settings.update_one(
        {"id": "default"},
        {"$set": {"id": "default", "provider": data.get("provider", "sendgrid"),
                   "sendgrid_api_key": data.get("sendgrid_api_key", ""),
                   "sendgrid_sender_email": data.get("sendgrid_sender_email", ""),
                   "sendgrid_sender_name": data.get("sendgrid_sender_name", "Silwer Lining Photography"),
                   "microsoft_tenant_id": data.get("microsoft_tenant_id", ""),
                   "microsoft_client_id": data.get("microsoft_client_id", ""),
                   "microsoft_client_secret": data.get("microsoft_client_secret", ""),
                   "microsoft_sender_email": data.get("microsoft_sender_email", ""),
                   "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True)
    return {"message": "Settings saved"}

@router.post("/admin/email-settings/test")
async def test_email_settings(data: dict, admin=Depends(verify_token)):
    test_email = data.get("email")
    if not test_email:
        raise HTTPException(status_code=400, detail="Email address required")
    success = await send_email(test_email, "Test Email - Silwer Lining Photography",
        "<html><body style='font-family: Arial; padding: 20px;'><h2 style='color: #A69F95;'>Test Email Successful!</h2><p>Your email configuration is working correctly.</p></body></html>")
    if success:
        return {"message": "Test email sent successfully!"}
    raise HTTPException(status_code=500, detail="Failed to send email. Check your settings.")


# ==================== ADMIN - ADDONS ====================

@router.get("/admin/addons")
async def admin_get_addons(admin=Depends(verify_token)):
    return await db.addons.find({}, {"_id": 0}).sort("order", 1).to_list(100)

@router.post("/admin/addons")
async def admin_create_addon(data: AddOnCreate, admin=Depends(verify_token)):
    addon = AddOn(**data.model_dump())
    await db.addons.insert_one(addon.model_dump())
    return addon

@router.put("/admin/addons/{addon_id}")
async def admin_update_addon(addon_id: str, data: AddOnCreate, admin=Depends(verify_token)):
    update_data = data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.addons.update_one({"id": addon_id}, {"$set": update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Add-on not found")
    return {"message": "Add-on updated"}

@router.delete("/admin/addons/{addon_id}")
async def admin_delete_addon(addon_id: str, admin=Depends(verify_token)):
    result = await db.addons.delete_one({"id": addon_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Add-on not found")
    return {"message": "Add-on deleted"}


# ==================== ADMIN - EMAIL TEMPLATES ====================

@router.get("/admin/email-templates")
async def admin_get_email_templates(admin=Depends(verify_token)):
    return await db.email_templates.find({}, {"_id": 0}).to_list(50)

@router.get("/admin/email-templates/{template_name}")
async def admin_get_email_template(template_name: str, admin=Depends(verify_token)):
    template = await db.email_templates.find_one({"name": template_name}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.post("/admin/email-templates")
async def admin_create_email_template(data: EmailTemplateCreate, admin=Depends(verify_token)):
    existing = await db.email_templates.find_one({"name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Template with this name already exists")
    template = EmailTemplate(**data.model_dump())
    template.display_name = data.name.replace("_", " ").title()
    await db.email_templates.insert_one(template.model_dump())
    return template

@router.put("/admin/email-templates/{template_id}")
async def admin_update_email_template(template_id: str, data: EmailTemplateCreate, admin=Depends(verify_token)):
    update_data = data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["display_name"] = data.name.replace("_", " ").title()
    result = await db.email_templates.update_one({"id": template_id}, {"$set": update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template updated"}

@router.delete("/admin/email-templates/{template_id}")
async def admin_delete_email_template(template_id: str, admin=Depends(verify_token)):
    result = await db.email_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}


# ==================== ADMIN - STORAGE / INSTAGRAM SETTINGS ====================

@router.get("/admin/storage-settings")
async def admin_get_storage_settings(admin=Depends(verify_token)):
    settings = await db.storage_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        return {"id": "default", "provider": "cloudflare_r2", "account_id": "", "access_key_id": "", "secret_access_key": "", "bucket_name": "", "public_url": ""}
    if settings.get("secret_access_key"):
        settings["secret_access_key"] = "••••••••" + settings["secret_access_key"][-4:] if len(settings["secret_access_key"]) > 4 else "••••••••"
    return settings

@router.put("/admin/storage-settings")
async def admin_update_storage_settings(data: StorageSettingsUpdate, admin=Depends(verify_token)):
    update_data = data.model_dump()
    if update_data.get("secret_access_key", "").startswith("••••"):
        existing = await db.storage_settings.find_one({"id": "default"})
        if existing:
            update_data["secret_access_key"] = existing.get("secret_access_key", "")
    await db.storage_settings.update_one({"id": "default"}, {"$set": update_data}, upsert=True)
    return {"message": "Storage settings updated"}

@router.get("/admin/instagram-settings")
async def admin_get_instagram_settings(admin=Depends(verify_token)):
    settings = await db.instagram_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        return {"id": "default", "access_token": "", "enabled": True, "post_count": 6}
    if settings.get("access_token"):
        token = settings["access_token"]
        settings["access_token"] = token[:10] + "••••••••" + token[-4:] if len(token) > 14 else "••••••••"
    return settings

@router.put("/admin/instagram-settings")
async def admin_update_instagram_settings(data: InstagramSettingsUpdate, admin=Depends(verify_token)):
    update_data = data.model_dump()
    if "••••" in update_data.get("access_token", ""):
        existing = await db.instagram_settings.find_one({"id": "default"})
        if existing:
            update_data["access_token"] = existing.get("access_token", "")
    await db.instagram_settings.update_one({"id": "default"}, {"$set": update_data}, upsert=True)
    return {"message": "Instagram settings updated"}


# ==================== ADMIN - FAQS ====================

@router.get("/admin/faqs")
async def admin_get_faqs(admin=Depends(verify_token)):
    return await db.faqs.find({}, {"_id": 0}).sort("order", 1).to_list(100)

@router.post("/admin/faqs")
async def admin_create_faq(data: FAQCreate, admin=Depends(verify_token)):
    faq = FAQ(**data.model_dump())
    await db.faqs.insert_one(faq.model_dump())
    return faq

@router.put("/admin/faqs/{faq_id}")
async def admin_update_faq(faq_id: str, data: FAQCreate, admin=Depends(verify_token)):
    result = await db.faqs.update_one({"id": faq_id}, {"$set": data.model_dump()})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="FAQ not found")
    return {"message": "FAQ updated"}

@router.delete("/admin/faqs/{faq_id}")
async def admin_delete_faq(faq_id: str, admin=Depends(verify_token)):
    result = await db.faqs.delete_one({"id": faq_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="FAQ not found")
    return {"message": "FAQ deleted"}

@router.put("/admin/faqs/reorder")
async def admin_reorder_faqs(faq_orders: List[dict], admin=Depends(verify_token)):
    for item in faq_orders:
        await db.faqs.update_one({"id": item["id"]}, {"$set": {"order": item["order"]}})
    return {"message": "FAQs reordered"}


# ==================== ADMIN - QUESTIONNAIRES ====================

@router.get("/admin/questionnaires")
async def admin_get_questionnaires(admin=Depends(verify_token)):
    return await db.questionnaires.find({}, {"_id": 0}).to_list(100)

@router.get("/admin/questionnaires/{session_type}")
async def admin_get_questionnaire_by_type(session_type: str, admin=Depends(verify_token)):
    item = await db.questionnaires.find_one({"session_type": session_type}, {"_id": 0})
    if not item:
        return {"session_type": session_type, "title": "", "description": "", "questions": [], "active": False}
    return item

@router.post("/admin/questionnaires")
async def admin_create_questionnaire(data: QuestionnaireCreate, admin=Depends(verify_token)):
    existing = await db.questionnaires.find_one({"session_type": data.session_type})
    if existing:
        update_data = data.model_dump()
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.questionnaires.update_one({"session_type": data.session_type}, {"$set": update_data})
        return {"message": "Questionnaire updated", "session_type": data.session_type}
    questionnaire = Questionnaire(**data.model_dump())
    await db.questionnaires.insert_one(questionnaire.model_dump())
    return {"message": "Questionnaire created", "id": questionnaire.id}

@router.put("/admin/questionnaires/{questionnaire_id}")
async def admin_update_questionnaire(questionnaire_id: str, data: QuestionnaireCreate, admin=Depends(verify_token)):
    update_data = data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.questionnaires.update_one({"id": questionnaire_id}, {"$set": update_data})
    if result.modified_count == 0:
        await db.questionnaires.update_one({"session_type": data.session_type}, {"$set": update_data})
    return {"message": "Questionnaire updated"}

@router.delete("/admin/questionnaires/{questionnaire_id}")
async def admin_delete_questionnaire(questionnaire_id: str, admin=Depends(verify_token)):
    result = await db.questionnaires.delete_one({"id": questionnaire_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    return {"message": "Questionnaire deleted"}


# ==================== ADMIN - CONTRACT ====================

@router.get("/admin/contract")
async def admin_get_contract(admin=Depends(verify_token)):
    contract = await db.contract_template.find_one({"id": "default"}, {"_id": 0})
    if not contract:
        return {"id": "default", "title": "Photography Session Contract",
                "content": "<h2>Photography Session Agreement</h2><p>This agreement is entered into between Silwer Lining Photography and the client.</p>",
                "smart_fields": [], "updated_at": datetime.now(timezone.utc).isoformat()}
    return contract

@router.put("/admin/contract")
async def admin_update_contract(data: dict, admin=Depends(verify_token)):
    update_data = {"id": "default", "title": data.get("title", "Photography Session Contract"),
                   "content": data.get("content", ""), "smart_fields": data.get("smart_fields", []),
                   "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.contract_template.update_one({"id": "default"}, {"$set": update_data}, upsert=True)
    return {"message": "Contract template updated"}

@router.get("/admin/bookings/{booking_id}/contract")
async def admin_get_booking_contract(booking_id: str, admin=Depends(verify_token)):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not booking.get("contract_signed"):
        return {"signed": False, "message": "Contract not signed"}
    contract = await db.contract_template.find_one({"id": "default"}, {"_id": 0})
    return {"signed": True, "contract_data": booking.get("contract_data", {}), "contract_template": contract,
            "client_name": booking.get("client_name"), "signed_at": booking.get("contract_data", {}).get("signed_at")}

@router.get("/admin/bookings/{booking_id}/contract/pdf")
async def admin_download_booking_contract_pdf(booking_id: str, admin=Depends(verify_token)):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not booking.get("contract_signed"):
        raise HTTPException(status_code=400, detail="Contract not signed")
    contract_template = await db.contract_template.find_one({"id": "default"}, {"_id": 0})
    if not contract_template:
        raise HTTPException(status_code=404, detail="Contract template not found")
    pdf_bytes = await generate_contract_pdf(booking, contract_template)
    if not pdf_bytes:
        raise HTTPException(status_code=500, detail="Failed to generate PDF")
    filename = f"contract_{booking.get('client_name', 'client').replace(' ', '_')}_{booking.get('booking_date', 'booking')}.pdf"
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename}"})


# ==================== ADMIN - CALENDAR SYNC ====================

@router.get("/admin/calendar-settings")
async def admin_get_calendar_settings(admin=Depends(verify_token)):
    settings = await db.calendar_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        settings = {"id": "default", "apple_calendar_url": "", "apple_calendar_user": "", "sync_enabled": False, "booking_calendar": ""}
    settings.pop("apple_calendar_password", None)
    return settings

@router.get("/admin/calendars")
async def admin_list_calendars(admin=Depends(verify_token)):
    return {"calendars": await get_all_caldav_calendars()}

@router.put("/admin/calendar-settings")
async def admin_update_calendar_settings(data: dict, admin=Depends(verify_token)):
    update_data = {"id": "default", "apple_calendar_url": data.get("apple_calendar_url", ""),
                   "apple_calendar_user": data.get("apple_calendar_user", ""),
                   "sync_enabled": data.get("sync_enabled", False), "booking_calendar": data.get("booking_calendar", "")}
    if data.get("apple_calendar_password"):
        update_data["apple_calendar_password"] = data.get("apple_calendar_password")
    await db.calendar_settings.update_one({"id": "default"}, {"$set": update_data}, upsert=True)
    return {"message": "Calendar settings updated"}

@router.post("/admin/calendar/sync")
async def admin_sync_calendar(admin=Depends(verify_token)):
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("sync_enabled"):
        raise HTTPException(status_code=400, detail="Calendar sync not enabled")
    if not settings.get("apple_calendar_password"):
        raise HTTPException(status_code=400, detail="Apple Calendar credentials not configured")
    dav_client, calendar = await get_caldav_client()
    if not calendar:
        raise HTTPException(status_code=400, detail="Failed to connect to Apple Calendar")
    bookings = await db.bookings.find({"status": "confirmed", "calendar_event_id": {"$exists": False}}).to_list(100)
    synced, errors = 0, 0
    for booking in bookings:
        booking_dict = {**booking, "id": booking.get("id")}
        event_uid = await create_calendar_event(booking_dict)
        if event_uid:
            await db.bookings.update_one({"id": booking["id"]}, {"$set": {"calendar_event_id": event_uid}})
            synced += 1
        else:
            errors += 1
    return {"message": "Calendar sync completed", "synced": synced, "errors": errors, "calendar_name": calendar.name if calendar else "Unknown"}

@router.post("/admin/calendar/test")
async def admin_test_calendar_connection(admin=Depends(verify_token)):
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("apple_calendar_password"):
        raise HTTPException(status_code=400, detail="Calendar settings not configured")
    _, calendar = await get_caldav_client()
    if not calendar:
        raise HTTPException(status_code=400, detail="Failed to connect to Apple Calendar")
    return {"status": "connected", "calendar_name": calendar.name, "message": f"Successfully connected to calendar: {calendar.name}"}

@router.get("/admin/calendar/events")
async def admin_get_calendar_events(date: str, admin=Depends(verify_token)):
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("sync_enabled"):
        raise HTTPException(status_code=400, detail="Calendar sync not enabled")
    _, calendar = await get_caldav_client()
    if not calendar:
        raise HTTPException(status_code=400, detail="Failed to connect to calendar")
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        start = date_obj.replace(hour=0, minute=0, second=0, tzinfo=timezone.utc)
        end = date_obj.replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        events = calendar.search(start=start, end=end, expand=True)
        event_list = []
        for event in events:
            ical = event.icalendar_component
            for component in ical.walk():
                if component.name == "VEVENT":
                    dtstart, dtend = component.get('dtstart'), component.get('dtend')
                    summary = str(component.get('summary', 'No Title'))
                    start_str = dtstart.dt.isoformat() if dtstart and hasattr(dtstart.dt, 'isoformat') else str(dtstart.dt) if dtstart else "Unknown"
                    end_str = dtend.dt.isoformat() if dtend and hasattr(dtend.dt, 'isoformat') else str(dtend.dt) if dtend else "Unknown"
                    is_booking = '\U0001f4f8' in summary or 'silwerlining' in summary.lower()
                    event_list.append({"summary": summary, "start": start_str, "end": end_str, "is_booking_event": is_booking, "blocks_availability": not is_booking})
        return {"date": date, "calendar_name": calendar.name, "event_count": len(event_list), "events": event_list}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching events: {str(e)}")


# ==================== ADMIN - FILE UPLOADS ====================

@router.post("/admin/upload")
async def admin_upload_file(admin=Depends(verify_token)):
    settings = await db.storage_settings.find_one({"id": "default"})
    if not settings or not settings.get("access_key_id"):
        raise HTTPException(status_code=400, detail="Storage not configured")
    return {"message": "Use /admin/upload-image endpoint with multipart form data"}

@router.post("/admin/upload-image")
async def admin_upload_image(file: UploadFile = File(...), admin=Depends(verify_token)):
    import boto3
    from botocore.config import Config
    settings = await db.storage_settings.find_one({"id": "default"})
    if not settings or not settings.get("access_key_id"):
        raise HTTPException(status_code=400, detail="Storage not configured")
    try:
        s3_client = boto3.client('s3', endpoint_url=f"https://{settings['account_id']}.r2.cloudflarestorage.com",
                                  aws_access_key_id=settings['access_key_id'], aws_secret_access_key=settings['secret_access_key'],
                                  config=Config(signature_version='s3v4'), region_name='auto')
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        unique_filename = f"portfolio/{uuid.uuid4()}.{file_ext}"
        content = await file.read()
        s3_client.put_object(Bucket=settings['bucket_name'], Key=unique_filename, Body=content, ContentType=file.content_type or 'image/jpeg')
        public_url = settings.get('public_url', '').rstrip('/')
        image_url = f"{public_url}/{unique_filename}" if public_url else f"https://{settings['bucket_name']}.{settings['account_id']}.r2.cloudflarestorage.com/{unique_filename}"
        return {"success": True, "url": image_url, "filename": unique_filename}
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/admin/upload-images")
async def admin_upload_multiple_images(files: List[UploadFile] = File(...), category: str = Query(...), admin=Depends(verify_token)):
    import boto3
    from botocore.config import Config
    settings = await db.storage_settings.find_one({"id": "default"})


# ==================== ADMIN - HERO SETTINGS ====================

@router.get("/admin/hero-settings")
async def admin_get_hero_settings(admin=Depends(verify_token)):
    settings = await db.hero_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        return {
            "id": "default",
            "subtitle": "Luxury Studio Photoshoots",
            "title_line1": "More Than Photos —",
            "title_highlight": "Capturing",
            "title_line2": "the Glow, the Love & the Memory",
            "description": "Professional studio photography in Roodepoort, Johannesburg. Specializing in maternity, newborn, family & portrait sessions with beautiful, styled shoots and outfits provided.",
            "image_url": "https://images-pw.pixieset.com/elementfield/1znyRr9/White-Fabric-Podium-1-84dab3dc-1500.jpg",
            "image_opacity": 100,
            "overlay_opacity": 70,
            "overlay_color": "warm-cream",
            "button1_text": "Book Your Session",
            "button2_text": "View Portfolio"
        }
    return settings

@router.put("/admin/hero-settings")
async def admin_update_hero_settings(data: dict, admin=Depends(verify_token)):
    data["id"] = "default"
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.hero_settings.update_one({"id": "default"}, {"$set": data}, upsert=True)
    return {"message": "Hero settings updated"}
    if not settings or not settings.get("access_key_id"):
        raise HTTPException(status_code=400, detail="Storage not configured")
    try:
        s3_client = boto3.client('s3', endpoint_url=f"https://{settings['account_id']}.r2.cloudflarestorage.com",
                                  aws_access_key_id=settings['access_key_id'], aws_secret_access_key=settings['secret_access_key'],
                                  config=Config(signature_version='s3v4'), region_name='auto')
        uploaded = []
        public_url = settings.get('public_url', '').rstrip('/')
        for file in files:
            file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
            unique_filename = f"portfolio/{uuid.uuid4()}.{file_ext}"
            content = await file.read()
            s3_client.put_object(Bucket=settings['bucket_name'], Key=unique_filename, Body=content, ContentType=file.content_type or 'image/jpeg')
            image_url = f"{public_url}/{unique_filename}" if public_url else f"https://{settings['bucket_name']}.{settings['account_id']}.r2.cloudflarestorage.com/{unique_filename}"
            portfolio_item = Portfolio(title=file.filename.rsplit('.', 1)[0] if '.' in file.filename else file.filename, category=category, image_url=image_url)
            await db.portfolio.insert_one(portfolio_item.model_dump())
            uploaded.append({"id": portfolio_item.id, "url": image_url, "filename": file.filename, "category": category})
        return {"success": True, "uploaded": uploaded, "count": len(uploaded)}
    except Exception as e:
        logger.error(f"Multi-upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
