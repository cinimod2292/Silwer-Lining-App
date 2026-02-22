import os
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from db import db, SENDGRID_API_KEY, SENDER_EMAIL, logger
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from auth import verify_token
from services.email import send_email

router = APIRouter()

# ==================== QUESTIONNAIRE REMINDERS (Legacy) ====================

@router.post("/admin/send-questionnaire-reminders")
async def send_questionnaire_reminders(admin=Depends(verify_token)):
    three_days_from_now = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d")
    bookings = await db.bookings.find({
        "booking_date": three_days_from_now,
        "questionnaire_completed": {"$ne": True},
        "questionnaire_reminder_sent": {"$ne": True},
        "status": {"$in": ["confirmed", "pending"]}
    }, {"_id": 0}).to_list(100)

    sent_count = 0
    frontend_url = os.environ.get('REACT_APP_BACKEND_URL', '').replace('/api', '')

    for booking in bookings:
        token = booking.get("manage_token") or booking.get("token")
        if token and booking.get("client_email"):
            try:
                manage_link = f"{frontend_url}/manage/{token}"
                html_content = f"""
                <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #A69F95;">Reminder: Complete Your Session Questionnaire</h2>
                    <p>Hi {booking.get('client_name', 'there')},</p>
                    <p>Your {booking.get('session_type', '').replace('-', ' ').title()} session is coming up in <strong>3 days</strong>!</p>
                    <p>Please complete your questionnaire so we can prepare for your session.</p>
                    <p style="margin: 30px 0;"><a href="{manage_link}" style="background-color: #A69F95; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Complete Questionnaire Now</a></p>
                    <p style="color: #666; font-size: 14px;"><strong>Session Date:</strong> {booking.get('booking_date')}<br><strong>Time:</strong> {booking.get('booking_time')}</p>
                </body></html>
                """
                message = Mail(from_email=SENDER_EMAIL, to_emails=booking['client_email'],
                               subject="Reminder: Complete Your Questionnaire - Session in 3 Days",
                               html_content=html_content)
                sg = SendGridAPIClient(SENDGRID_API_KEY)
                sg.send(message)
                await db.bookings.update_one({"id": booking["id"]}, {"$set": {"questionnaire_reminder_sent": True}})
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to send reminder for booking {booking['id']}: {e}")

    return {"message": f"Sent {sent_count} questionnaire reminders"}


# ==================== AUTOMATED REMINDERS MANAGEMENT ====================

@router.get("/admin/automated-reminders")
async def get_automated_reminders(admin=Depends(verify_token)):
    doc = await db.automated_reminders.find_one({"id": "default"}, {"_id": 0})
    return doc.get("reminders", []) if doc else []

@router.put("/admin/automated-reminders")
async def save_automated_reminders(data: dict, admin=Depends(verify_token)):
    await db.automated_reminders.update_one(
        {"id": "default"},
        {"$set": {"id": "default", "reminders": data.get("reminders", []),
                   "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"message": "Reminders saved"}

@router.post("/admin/run-reminder")
async def run_reminder_manually(data: dict, admin=Depends(verify_token)):
    reminder_id = data.get("reminder_id")
    doc = await db.automated_reminders.find_one({"id": "default"}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="No reminders configured")
    reminder = next((r for r in doc.get("reminders", []) if r.get("id") == reminder_id), None)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    sent_count = await process_reminder(reminder)
    return {"sent_count": sent_count}


# ==================== CRON ENDPOINTS ====================

@router.post("/cron/process-reminders")
async def cron_process_reminders():
    """Process all active reminders - called by background scheduler or manually"""
    doc = await db.automated_reminders.find_one({"id": "default"}, {"_id": 0})
    if not doc:
        return {"message": "No reminders configured", "total_sent": 0}

    total_sent = 0
    for reminder in doc.get("reminders", []):
        if reminder.get("active", False):
            sent = await process_reminder(reminder)
            total_sent += sent

    return {"message": "Processed reminders", "total_sent": total_sent}

@router.post("/cron/fetch-google-reviews")
async def cron_fetch_google_reviews():
    import httpx
    settings = await db.google_reviews_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings or not settings.get("enabled") or not settings.get("auto_fetch"):
        return {"message": "Auto-fetch not enabled"}

    last_fetched = settings.get("last_fetched")
    frequency = settings.get("fetch_frequency", "daily")
    if last_fetched:
        last_dt = datetime.fromisoformat(last_fetched.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        if frequency == "daily" and (now - last_dt) < timedelta(days=1):
            return {"message": "Already fetched today"}
        elif frequency == "weekly" and (now - last_dt) < timedelta(weeks=1):
            return {"message": "Already fetched this week"}
        elif frequency == "monthly" and (now - last_dt) < timedelta(days=30):
            return {"message": "Already fetched this month"}

    api_key = settings.get("api_key")
    place_id = settings.get("place_id")
    if not api_key or not place_id:
        return {"message": "Missing API credentials"}

    try:
        url = "https://maps.googleapis.com/maps/api/place/details/json"
        params = {"place_id": place_id, "fields": "reviews", "key": api_key}
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(url, params=params, timeout=10.0)
            data = response.json()
        if data.get("status") != "OK":
            return {"message": f"Google API error: {data.get('status')}"}

        reviews = data.get("result", {}).get("reviews", [])[:5]
        count = 0
        for review in reviews:
            review_id = f"google_{review.get('time', '')}"
            existing = await db.testimonials.find_one({"id": review_id})
            if existing:
                continue
            await db.testimonials.insert_one({
                "id": review_id, "source": "google",
                "client_name": review.get("author_name", "Google User"),
                "author_name": review.get("author_name", ""),
                "profile_photo_url": review.get("profile_photo_url", ""),
                "rating": review.get("rating", 5), "content": review.get("text", ""),
                "text": review.get("text", ""), "relative_time_description": review.get("relative_time_description", ""),
                "time": review.get("time", 0), "session_type": "google",
                "approved": True, "created_at": datetime.now(timezone.utc).isoformat()
            })
            count += 1

        await db.google_reviews_settings.update_one(
            {"id": "default"}, {"$set": {"last_fetched": datetime.now(timezone.utc).isoformat()}}
        )
        return {"message": f"Fetched {count} new reviews", "count": count}
    except Exception as e:
        return {"message": f"Error: {str(e)}"}


# ==================== REMINDER PROCESSING ====================

async def process_reminder(reminder: dict) -> int:
    """Process a single reminder and send emails using configured email provider"""
    trigger_type = reminder.get("trigger_type", "days_before_session")
    trigger_days = reminder.get("trigger_days", 1)
    condition = reminder.get("condition", "")

    if trigger_type == "days_before_session":
        target_date = (datetime.now(timezone.utc) + timedelta(days=trigger_days)).strftime("%Y-%m-%d")
        query = {"booking_date": target_date, "status": {"$in": ["confirmed", "pending"]}}
    else:
        target_date = (datetime.now(timezone.utc) - timedelta(days=trigger_days)).strftime("%Y-%m-%d")
        query = {"created_at": {"$regex": f"^{target_date}"}, "status": {"$in": ["confirmed", "pending", "awaiting_payment"]}}

    if condition == "questionnaire_incomplete":
        query["questionnaire_completed"] = {"$ne": True}
    elif condition == "payment_pending":
        query["payment_status"] = {"$in": ["pending", "", None]}

    reminder_key = f"reminder_sent_{reminder.get('id', 'unknown')}"
    query[reminder_key] = {"$ne": True}

    bookings = await db.bookings.find(query, {"_id": 0}).to_list(100)
    sent_count = 0
    frontend_url = os.environ.get('REACT_APP_BACKEND_URL', '').replace('/api', '')

    for booking in bookings:
        if not booking.get("client_email"):
            continue
        try:
            manage_token = booking.get("manage_token") or booking.get("token", "")
            subject = reminder.get("subject", "Reminder")
            body = reminder.get("body", "")

            replacements = {
                "{{client_name}}": booking.get("client_name", ""),
                "{{session_type}}": booking.get("session_type", "").replace("-", " ").title(),
                "{{booking_date}}": booking.get("booking_date", ""),
                "{{booking_time}}": booking.get("booking_time", ""),
                "{{package_name}}": booking.get("package_name", ""),
                "{{manage_link}}": f"{frontend_url}/manage/{manage_token}" if manage_token else "",
                "{{payment_link}}": f"{frontend_url}/complete-payment/{booking.get('id', '')}",
                "{{amount_due}}": str(booking.get("total_price", 0) - booking.get("amount_paid", 0)),
            }
            for key, val in replacements.items():
                subject = subject.replace(key, val)
                body = body.replace(key, val)

            html_body = body.replace("\n", "<br>")
            html_content = f"""<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">{html_body}</body></html>"""

            success = await send_email(booking["client_email"], subject, html_content)
            if success:
                await db.bookings.update_one({"id": booking["id"]}, {"$set": {reminder_key: True}})
                sent_count += 1

        except Exception as e:
            logger.error(f"Failed to send reminder to {booking.get('client_email')}: {e}")

    return sent_count


# ==================== BACKGROUND SCHEDULER ====================

async def reminder_scheduler():
    """Background task that runs reminder processing every hour"""
    logger.info("Reminder scheduler started - checking every hour")
    while True:
        try:
            await asyncio.sleep(3600)  # Wait 1 hour
            logger.info("Running scheduled reminder check...")

            # Process automated reminders
            doc = await db.automated_reminders.find_one({"id": "default"}, {"_id": 0})
            if doc:
                total_sent = 0
                for reminder in doc.get("reminders", []):
                    if reminder.get("active", False):
                        sent = await process_reminder(reminder)
                        total_sent += sent
                if total_sent > 0:
                    logger.info(f"Scheduler: Sent {total_sent} reminders")

            # Auto-fetch Google reviews
            try:
                import httpx
                settings = await db.google_reviews_settings.find_one({"id": "default"}, {"_id": 0})
                if settings and settings.get("enabled") and settings.get("auto_fetch"):
                    last_fetched = settings.get("last_fetched")
                    frequency = settings.get("fetch_frequency", "daily")
                    should_fetch = True

                    if last_fetched:
                        last_dt = datetime.fromisoformat(last_fetched.replace("Z", "+00:00"))
                        now = datetime.now(timezone.utc)
                        if frequency == "daily" and (now - last_dt) < timedelta(days=1):
                            should_fetch = False
                        elif frequency == "weekly" and (now - last_dt) < timedelta(weeks=1):
                            should_fetch = False
                        elif frequency == "monthly" and (now - last_dt) < timedelta(days=30):
                            should_fetch = False

                    if should_fetch:
                        api_key = settings.get("api_key")
                        place_id = settings.get("place_id")
                        if api_key and place_id:
                            url = "https://maps.googleapis.com/maps/api/place/details/json"
                            params = {"place_id": place_id, "fields": "reviews", "key": api_key}
                            async with httpx.AsyncClient() as http_client:
                                response = await http_client.get(url, params=params, timeout=10.0)
                                data = response.json()
                            if data.get("status") == "OK":
                                reviews = data.get("result", {}).get("reviews", [])[:5]
                                for review in reviews:
                                    review_id = f"google_{review.get('time', '')}"
                                    existing = await db.testimonials.find_one({"id": review_id})
                                    if not existing:
                                        await db.testimonials.insert_one({
                                            "id": review_id, "source": "google",
                                            "client_name": review.get("author_name", "Google User"),
                                            "author_name": review.get("author_name", ""),
                                            "profile_photo_url": review.get("profile_photo_url", ""),
                                            "rating": review.get("rating", 5),
                                            "content": review.get("text", ""), "text": review.get("text", ""),
                                            "relative_time_description": review.get("relative_time_description", ""),
                                            "time": review.get("time", 0), "session_type": "google",
                                            "approved": True, "created_at": datetime.now(timezone.utc).isoformat()
                                        })
                                await db.google_reviews_settings.update_one(
                                    {"id": "default"}, {"$set": {"last_fetched": datetime.now(timezone.utc).isoformat()}}
                                )
                                logger.info("Scheduler: Google reviews fetched")
            except Exception as e:
                logger.error(f"Scheduler: Google reviews fetch error: {e}")

        except asyncio.CancelledError:
            logger.info("Reminder scheduler stopped")
            break
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
            await asyncio.sleep(60)  # Wait 1 min on error before retrying
