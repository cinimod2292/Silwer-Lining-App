import os
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from db import db, SENDGRID_API_KEY, SENDER_EMAIL, logger
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from auth import verify_token

router = APIRouter()


@router.get("/client/booking/{token}")
async def get_client_booking(token: str):
    booking = await db.bookings.find_one(
        {"$or": [{"token": token}, {"manage_token": token}]}, {"_id": 0}
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    questionnaire = await db.questionnaires.find_one(
        {"session_type": booking.get("session_type"), "active": True}, {"_id": 0}
    )
    return {"booking": booking, "questionnaire": questionnaire}


@router.post("/client/booking/{token}/questionnaire")
async def save_client_questionnaire(token: str, data: dict):
    booking = await db.bookings.find_one({"$or": [{"token": token}, {"manage_token": token}]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    await db.bookings.update_one(
        {"id": booking["id"]},
        {"$set": {
            "questionnaire_responses": data.get("responses", {}),
            "questionnaire_completed": True,
            "questionnaire_completed_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Questionnaire saved"}


@router.post("/client/booking/{token}/email-questionnaire")
async def email_questionnaire_link(token: str):
    booking = await db.bookings.find_one(
        {"$or": [{"token": token}, {"manage_token": token}]}, {"_id": 0}
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not SENDGRID_API_KEY:
        raise HTTPException(status_code=500, detail="Email not configured")

    frontend_url = os.environ.get('REACT_APP_BACKEND_URL', '').replace('/api', '')
    manage_link = f"{frontend_url}/manage/{token}"

    html_content = f"""
    <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #A69F95;">Complete Your Session Questionnaire</h2>
        <p>Hi {booking.get('client_name', 'there')},</p>
        <p>Please complete your session questionnaire to help us prepare for your upcoming {booking.get('session_type', '').replace('-', ' ').title()} session.</p>
        <p style="margin: 30px 0;">
            <a href="{manage_link}" style="background-color: #A69F95; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Complete Questionnaire</a>
        </p>
        <p style="color: #666; font-size: 14px;"><strong>Session Date:</strong> {booking.get('booking_date', 'TBD')}<br><strong>Time:</strong> {booking.get('booking_time', 'TBD')}</p>
    </body></html>
    """

    try:
        message = Mail(from_email=SENDER_EMAIL, to_emails=booking['client_email'],
                       subject="Complete Your Session Questionnaire - Silwer Lining Photography",
                       html_content=html_content)
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        sg.send(message)
        return {"message": "Email sent"}
    except Exception as e:
        logger.error(f"Failed to send questionnaire email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email")


@router.post("/client/booking/{token}/request-reschedule")
async def request_reschedule(token: str):
    booking = await db.bookings.find_one({"$or": [{"token": token}, {"manage_token": token}]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    await db.bookings.update_one(
        {"id": booking["id"]},
        {"$set": {"reschedule_requested": True,
                   "reschedule_requested_at": datetime.now(timezone.utc).isoformat(),
                   "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    if SENDGRID_API_KEY:
        try:
            message = Mail(from_email=SENDER_EMAIL, to_emails=SENDER_EMAIL,
                           subject=f"Reschedule Request - {booking.get('client_name')}",
                           html_content=f"<p>Client <strong>{booking.get('client_name')}</strong> has requested to reschedule.</p><p><strong>Current Date:</strong> {booking.get('booking_date')} at {booking.get('booking_time')}</p>")
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            sg.send(message)
        except Exception as e:
            logger.error(f"Failed to send reschedule notification: {e}")

    return {"message": "Reschedule request sent"}


@router.post("/client/booking/{token}/request-cancel")
async def request_cancellation(token: str):
    booking = await db.bookings.find_one({"$or": [{"token": token}, {"manage_token": token}]})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    await db.bookings.update_one(
        {"id": booking["id"]},
        {"$set": {"cancellation_requested": True,
                   "cancellation_requested_at": datetime.now(timezone.utc).isoformat(),
                   "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    if SENDGRID_API_KEY:
        try:
            message = Mail(from_email=SENDER_EMAIL, to_emails=SENDER_EMAIL,
                           subject=f"Cancellation Request - {booking.get('client_name')}",
                           html_content=f"<p>Client <strong>{booking.get('client_name')}</strong> has requested to cancel.</p><p><strong>Date:</strong> {booking.get('booking_date')} at {booking.get('booking_time')}</p>")
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            sg.send(message)
        except Exception as e:
            logger.error(f"Failed to send cancellation notification: {e}")

    return {"message": "Cancellation request sent"}
