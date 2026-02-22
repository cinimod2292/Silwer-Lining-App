from fastapi import APIRouter, BackgroundTasks, Query
from typing import Optional
from datetime import datetime, timezone
from db import db, logger
from models import (
    BookingCreate, Booking, BookingSettings,
    ContactMessageCreate, ContactMessage
)
from services.email import send_booking_confirmation_email
from services.contracts import generate_contract_pdf
from services.email import send_contract_email
from services.calendar import create_calendar_event, get_calendar_blocked_times

router = APIRouter()


# ==================== ROOT / HEALTH ====================

@router.get("/")
async def root():
    return {"message": "Silwer Lining Photography API"}

@router.get("/health")
async def health_check():
    return {"status": "healthy"}


# ==================== PACKAGES (Public) ====================

@router.get("/packages")
async def get_packages(session_type: Optional[str] = None, active_only: bool = True):
    query = {}
    if session_type:
        query["session_type"] = session_type
    if active_only:
        query["active"] = True
    packages = await db.packages.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    if not packages:
        return get_default_packages(session_type)
    return packages


def get_default_packages(session_type: Optional[str] = None):
    defaults = [
        {"id": "mat-essential", "name": "Essential", "session_type": "maternity", "price": 3500, "duration": "1-2 hours", "includes": ["Studio session", "10 edited digital images", "Online gallery", "2 outfit changes", "Outfits provided"], "popular": False, "active": True, "order": 0},
        {"id": "mat-signature", "name": "Signature", "session_type": "maternity", "price": 5500, "duration": "2-3 hours", "includes": ["Full studio session", "25 edited digital images", "Online gallery", "4 outfit changes", "Outfits provided", "Partner included"], "popular": True, "active": True, "order": 1},
        {"id": "mat-luxury", "name": "Luxury Collection", "session_type": "maternity", "price": 8500, "duration": "3+ hours", "includes": ["Premium studio session", "50+ edited digital images", "Online gallery", "Unlimited outfit changes", "Premium outfits", "Professional makeup included"], "popular": False, "active": True, "order": 2},
        {"id": "new-precious", "name": "Precious Moments", "session_type": "newborn", "price": 4500, "duration": "2-3 hours", "includes": ["Baby-led studio session", "15 edited digital images", "Online gallery", "3-4 setups", "Props & wraps provided"], "popular": False, "active": True, "order": 3},
        {"id": "new-complete", "name": "Complete Collection", "session_type": "newborn", "price": 7000, "duration": "3-4 hours", "includes": ["Extended baby-led session", "30 edited digital images", "Online gallery", "6+ setups", "Premium props", "Family portraits"], "popular": True, "active": True, "order": 4},
        {"id": "new-heirloom", "name": "Heirloom", "session_type": "newborn", "price": 10000, "duration": "4+ hours", "includes": ["Full newborn experience", "50+ edited digital images", "Online gallery", "Unlimited setups", "Premium props", "Fine art album"], "popular": False, "active": True, "order": 5},
        {"id": "studio-mini", "name": "Mini Session", "session_type": "studio", "price": 2500, "duration": "30-45 min", "includes": ["Quick studio session", "8 edited digital images", "Online gallery", "1-2 setups"], "popular": False, "active": True, "order": 6},
        {"id": "studio-classic", "name": "Classic", "session_type": "studio", "price": 4000, "duration": "1-1.5 hours", "includes": ["Full studio session", "20 edited digital images", "Online gallery", "3-4 setups", "Props included"], "popular": True, "active": True, "order": 7},
        {"id": "studio-premium", "name": "Premium", "session_type": "studio", "price": 6500, "duration": "2+ hours", "includes": ["Extended studio session", "40 edited digital images", "Online gallery", "6+ setups", "Fine art print"], "popular": False, "active": True, "order": 8},
    ]
    if session_type:
        return [p for p in defaults if p["session_type"] == session_type]
    return defaults


# ==================== BOOKING SETTINGS (Public) ====================

@router.get("/booking-settings")
async def get_booking_settings_public():
    settings = await db.booking_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        settings = BookingSettings().model_dump()
    return settings


# ==================== PAYMENT SETTINGS (Public) ====================

@router.get("/payment-settings")
async def get_payment_settings_public():
    """Public endpoint for payment settings (bank details & enabled methods)"""
    settings = await db.payment_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        settings = {
            "bank_name": "", "account_holder": "", "account_number": "",
            "branch_code": "", "account_type": "", "reference_format": "BOOKING-{booking_id}",
            "payfast_enabled": True, "payflex_enabled": False
        }
    # Return only public-facing info (not sandbox credentials)
    return {
        "bank_name": settings.get("bank_name", ""),
        "account_holder": settings.get("account_holder", ""),
        "account_number": settings.get("account_number", ""),
        "branch_code": settings.get("branch_code", ""),
        "account_type": settings.get("account_type", ""),
        "reference_format": settings.get("reference_format", "BOOKING-{booking_id}"),
        "payfast_enabled": settings.get("payfast_enabled", True),
        "payflex_enabled": settings.get("payflex_enabled", False)
    }


# ==================== AVAILABLE TIMES ====================

@router.get("/bookings/available-times")
async def get_available_times(date: str, session_type: Optional[str] = None):
    settings = await db.booking_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        settings = BookingSettings().model_dump()

    if date in settings.get("blocked_dates", []):
        return {"date": date, "available_times": [], "message": "This date is not available"}

    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        day_of_week = date_obj.weekday()
        day_id = (day_of_week + 1) % 7
        is_weekend = day_id in [0, 6]
    except ValueError:
        return {"date": date, "available_times": [], "message": "Invalid date format"}

    time_slot_schedule = settings.get("time_slot_schedule", {})
    all_times = []

    if session_type and time_slot_schedule.get(session_type):
        session_schedule = time_slot_schedule[session_type]
        all_times = session_schedule.get(str(day_id), [])
    elif time_slot_schedule:
        for st, schedule in time_slot_schedule.items():
            day_slots = schedule.get(str(day_id), [])
            all_times.extend([s for s in day_slots if s not in all_times])
        all_times = sorted(list(set(all_times)))

    custom_slots = await db.custom_slots.find({"date": date}, {"_id": 0}).to_list(50)
    for cs in custom_slots:
        if cs["time"] not in all_times:
            all_times.append(cs["time"])
    all_times = sorted(list(set(all_times)))

    if not all_times:
        return {"date": date, "available_times": [], "message": "No time slots available for this day", "is_weekend": is_weekend}

    booked = await db.bookings.find(
        {"booking_date": date, "status": {"$nin": ["cancelled"]}},
        {"_id": 0, "booking_time": 1}
    ).to_list(100)
    booked_times = [b["booking_time"] for b in booked]

    calendar_blocked_times = await get_calendar_blocked_times(date, all_times)
    unavailable_times = set(booked_times + calendar_blocked_times)
    available = [t for t in all_times if t not in unavailable_times]

    return {
        "date": date, "available_times": available, "is_weekend": is_weekend,
        "weekend_surcharge": settings.get("weekend_surcharge", 750) if is_weekend else 0,
        "session_type": session_type,
        "calendar_blocked": len(calendar_blocked_times) > 0
    }


# ==================== CREATE BOOKING ====================

@router.post("/bookings")
async def create_booking(booking_data: BookingCreate, background_tasks: BackgroundTasks):
    booking = Booking(**booking_data.model_dump())
    doc = booking.model_dump()
    await db.bookings.insert_one(doc)

    background_tasks.add_task(send_booking_confirmation_email, doc)
    background_tasks.add_task(create_calendar_event_background, doc)
    if doc.get("contract_signed"):
        background_tasks.add_task(send_contract_pdf_background, doc)

    return booking


async def send_contract_pdf_background(booking_dict: dict):
    try:
        contract_template = await db.contract_template.find_one({"id": "default"}, {"_id": 0})
        if not contract_template:
            return
        pdf_bytes = await generate_contract_pdf(booking_dict, contract_template)
        if not pdf_bytes:
            return
        admin = await db.admin_users.find_one({}, {"_id": 0, "email": 1})
        from db import SENDER_EMAIL
        admin_email = admin.get("email") if admin else SENDER_EMAIL
        await send_contract_email(booking_dict, pdf_bytes, admin_email)
    except Exception as e:
        logger.error(f"Failed to send contract PDF: {e}")


async def create_calendar_event_background(booking_dict: dict):
    try:
        event_uid = await create_calendar_event(booking_dict)
        if event_uid:
            await db.bookings.update_one(
                {"id": booking_dict["id"]},
                {"$set": {"calendar_event_id": event_uid}}
            )
    except Exception as e:
        logger.error(f"Failed to create calendar event: {e}")


# ==================== PORTFOLIO / TESTIMONIALS / CONTACT / FAQS (Public) ====================

@router.get("/portfolio")
async def get_portfolio(category: Optional[str] = None, featured_only: bool = False):
    query = {}
    if category:
        query["category"] = category
    if featured_only:
        query["featured"] = True
    return await db.portfolio.find(query, {"_id": 0}).sort("order", 1).to_list(100)

@router.get("/testimonials")
async def get_testimonials():
    return await db.testimonials.find({"approved": True}, {"_id": 0}).to_list(50)

@router.post("/contact")
async def submit_contact(data: ContactMessageCreate):
    message = ContactMessage(**data.model_dump())
    doc = message.model_dump()
    await db.contact_messages.insert_one(doc)
    return message

@router.get("/faqs")
async def get_faqs(category: Optional[str] = None):
    query = {"active": True}
    if category:
        query["category"] = category
    return await db.faqs.find(query, {"_id": 0}).sort("order", 1).to_list(100)

@router.get("/addons")
async def get_public_addons(session_type: Optional[str] = None):
    query = {"active": True}
    items = await db.addons.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    if session_type:
        items = [item for item in items if not item.get("categories") or session_type in item.get("categories", [])]
    return items

@router.get("/questionnaire/{session_type}")
async def get_public_questionnaire(session_type: str):
    item = await db.questionnaires.find_one({"session_type": session_type, "active": True}, {"_id": 0})
    if not item:
        return {"questions": []}
    return item

@router.get("/contract")
async def get_public_contract():
    contract = await db.contract_template.find_one({"id": "default"}, {"_id": 0})
    if not contract:
        return {"id": "default", "title": "Photography Session Contract", "content": "", "smart_fields": []}
    return contract


# ==================== BOOKING TOKEN (Manual Booking) ====================

@router.get("/booking-token/{token}")
async def get_booking_by_token(token: str):
    from fastapi import HTTPException
    token_doc = await db.booking_tokens.find_one({"token": token}, {"_id": 0})
    if not token_doc:
        raise HTTPException(status_code=404, detail="Invalid or expired booking link")
    if token_doc.get("used"):
        raise HTTPException(status_code=400, detail="This booking link has already been used")
    expires_at = datetime.fromisoformat(token_doc["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="This booking link has expired")

    booking = await db.bookings.find_one({"id": token_doc["booking_id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    packages = await db.packages.find({"session_type": booking["session_type"], "active": True}, {"_id": 0}).sort("order", 1).to_list(20)
    addons = await db.addons.find({"active": True, "$or": [{"categories": {"$in": [booking["session_type"]]}}, {"categories": {"$size": 0}}]}, {"_id": 0}).to_list(50)
    questionnaire = await db.questionnaires.find_one({"session_type": booking["session_type"], "active": True}, {"_id": 0})

    return {"booking": booking, "packages": packages, "addons": addons, "questionnaire": questionnaire}

@router.post("/booking-token/{token}/complete")
async def complete_booking_by_token(token: str, data: dict, background_tasks: BackgroundTasks):
    from fastapi import HTTPException
    token_doc = await db.booking_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=404, detail="Invalid booking link")
    if token_doc.get("used"):
        raise HTTPException(status_code=400, detail="This booking link has already been used")
    expires_at = datetime.fromisoformat(token_doc["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="This booking link has expired")

    update_data = {
        "package_id": data.get("package_id", ""), "package_name": data.get("package_name", ""),
        "package_price": data.get("package_price", 0), "selected_addons": data.get("selected_addons", []),
        "addons_total": data.get("addons_total", 0), "total_price": data.get("total_price", 0),
        "questionnaire_responses": data.get("questionnaire_responses", {}),
        "client_phone": data.get("client_phone", ""), "notes": data.get("notes", ""),
        "status": "confirmed", "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bookings.update_one({"id": token_doc["booking_id"]}, {"$set": update_data})
    await db.booking_tokens.update_one({"token": token}, {"$set": {"used": True}})

    booking = await db.bookings.find_one({"id": token_doc["booking_id"]}, {"_id": 0})
    background_tasks.add_task(send_booking_confirmation_email, booking)
    background_tasks.add_task(create_calendar_event_background, booking)

    return {"message": "Booking completed successfully", "booking": booking}


# ==================== INSTAGRAM FEED ====================

@router.get("/instagram/feed")
async def get_instagram_feed():
    import httpx
    settings = await db.instagram_settings.find_one({"id": "default"})
    if not settings or not settings.get("enabled") or not settings.get("access_token"):
        return {"posts": [], "error": "Instagram not configured"}

    try:
        access_token = settings["access_token"]
        post_count = settings.get("post_count", 6)
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                "https://graph.instagram.com/me/media",
                params={"fields": "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp", "access_token": access_token, "limit": post_count},
                timeout=10.0
            )
            if response.status_code != 200:
                return {"posts": [], "error": "Failed to fetch Instagram feed"}
            data = response.json()
            posts = data.get("data", [])
            filtered_posts = [
                {"id": post["id"], "image_url": post.get("media_url") or post.get("thumbnail_url"),
                 "caption": post.get("caption", "")[:100] if post.get("caption") else "",
                 "permalink": post.get("permalink"), "timestamp": post.get("timestamp")}
                for post in posts if post.get("media_type") in ["IMAGE", "CAROUSEL_ALBUM"]
            ]
            return {"posts": filtered_posts}
    except Exception as e:
        logger.error(f"Instagram feed error: {str(e)}")
        return {"posts": [], "error": str(e)}


# ==================== GOOGLE REVIEWS (Public) ====================

@router.get("/google-reviews/public")
async def get_public_google_reviews():
    settings = await db.google_reviews_settings.find_one({"id": "default"}, {"_id": 0})
    reviews = await db.testimonials.find({"source": "google", "approved": True}, {"_id": 0}).sort("time", -1).limit(5).to_list(5)
    place_id = settings.get("place_id", "") if settings else ""
    return {
        "reviews": reviews, "place_id": place_id,
        "google_url": f"https://search.google.com/local/reviews?placeid={place_id}" if place_id else ""
    }


# ==================== PAYMENT SETTINGS (Public) ====================

@router.get("/payments/settings")
async def get_payment_settings_public():
    settings = await db.payment_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        settings = {"bank_name": "", "account_holder": "", "account_number": "", "branch_code": "", "account_type": "", "payfast_enabled": True, "payflex_enabled": False}
    return {
        "bank_name": settings.get("bank_name", ""), "account_holder": settings.get("account_holder", ""),
        "account_number": settings.get("account_number", ""), "branch_code": settings.get("branch_code", ""),
        "account_type": settings.get("account_type", ""),
        "reference_format": settings.get("reference_format", "BOOKING-{booking_id}"),
        "payfast_enabled": settings.get("payfast_enabled", True),
        "payflex_enabled": settings.get("payflex_enabled", False)
    }
