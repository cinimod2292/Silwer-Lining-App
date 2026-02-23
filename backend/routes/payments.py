import os
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import Response
from datetime import datetime, timezone, timedelta
from typing import List
import uuid
import hashlib
import urllib.parse
import httpx
from db import db, SENDGRID_API_KEY, SENDER_EMAIL, logger
from services.payments import (
    get_payfast_credentials, calculate_payfast_signature_with_creds,
    verify_payfast_signature_async
)
from models import PaymentSettings
from auth import verify_token

router = APIRouter()


# ==================== PAYFAST ITN ====================

@router.post("/payments/payfast-itn")
async def handle_payfast_itn(request: Request):
    try:
        form_data = await request.form()
        data = dict(form_data)
        logger.info(f"PayFast ITN received: {data}")

        booking_id = data.get("m_payment_id")
        if not booking_id:
            return Response(content="No booking ID", status_code=400)

        pf_creds = await get_payfast_credentials()
        received_merchant_id = data.get("merchant_id")
        if received_merchant_id != pf_creds["merchant_id"]:
            logger.error(f"PayFast ITN: Invalid merchant ID")
            return Response(content="Invalid merchant", status_code=400)

        signature = data.get("signature", "")
        sig_valid = await verify_payfast_signature_async(data, signature)
        if not sig_valid:
            if pf_creds["is_sandbox"]:
                logger.warning(f"PayFast ITN: Signature mismatch - proceeding (sandbox)")
            else:
                return Response(content="Invalid signature", status_code=400)

        booking = await db.bookings.find_one({"id": booking_id})
        if not booking:
            return Response(content="Booking not found", status_code=404)

        payment_status = data.get("payment_status", "")
        pf_payment_id = data.get("pf_payment_id", "")
        amount_gross = float(data.get("amount_gross", 0))

        if payment_status == "COMPLETE":
            await db.bookings.update_one(
                {"id": booking_id},
                {"$set": {"payment_status": "complete", "pf_payment_id": pf_payment_id,
                           "amount_paid": amount_gross, "status": "confirmed",
                           "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        elif payment_status == "FAILED":
            await db.bookings.update_one(
                {"id": booking_id},
                {"$set": {"payment_status": "failed", "status": "payment_failed",
                           "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        elif payment_status == "PENDING":
            await db.bookings.update_one(
                {"id": booking_id},
                {"$set": {"payment_status": "pending", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )

        return Response(content="OK", status_code=200)
    except Exception as e:
        logger.error(f"PayFast ITN error: {str(e)}")
        return Response(content="Server error", status_code=500)


# ==================== PAYMENT SETTINGS (Admin) ====================

@router.get("/admin/payment-settings")
async def admin_get_payment_settings(admin=Depends(verify_token)):
    settings = await db.payment_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        return PaymentSettings().model_dump()
    return settings

@router.put("/admin/payment-settings")
async def admin_update_payment_settings(data: dict, admin=Depends(verify_token)):
    data["id"] = "default"
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.payment_settings.update_one({"id": "default"}, {"$set": data}, upsert=True)
    return {"message": "Payment settings updated"}


# ==================== INITIATE PAYMENT ====================

@router.post("/payments/initiate")
async def initiate_payment(data: dict, request: Request):
    booking_id = data.get("booking_id")
    payment_method = data.get("payment_method")
    payment_type = data.get("payment_type", "deposit")

    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    total_price = booking.get("total_price", 0)
    amount = total_price if payment_type == "full" else int(total_price * 0.5)

    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"payment_method": payment_method, "payment_type": payment_type,
                   "payment_status": "pending",
                   "status": "awaiting_payment" if payment_method != "eft" else "awaiting_eft",
                   "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    if payment_method == "payfast":
        pf_creds = await get_payfast_credentials()
        # Read public frontend URL from frontend .env
        import pathlib
        frontend_env = pathlib.Path(__file__).parent.parent.parent / "frontend" / ".env"
        base_url = ""
        try:
            for line in frontend_env.read_text().splitlines():
                if line.startswith("REACT_APP_BACKEND_URL="):
                    base_url = line.split("=", 1)[1].strip()
                    break
        except Exception:
            pass

        name_parts = booking.get("client_name", "").split(" ", 1)
        first_name = name_parts[0].strip() if name_parts else "Customer"
        last_name = name_parts[1].strip() if len(name_parts) > 1 else "Customer"

        cell_raw = booking.get("client_phone", "").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        if cell_raw.startswith("+27"):
            cell_number = "0" + cell_raw[3:]
        elif cell_raw.startswith("27"):
            cell_number = "0" + cell_raw[2:]
        elif cell_raw.startswith("0"):
            cell_number = cell_raw
        else:
            cell_number = cell_raw
        cell_number = ''.join(filter(str.isdigit, cell_number))

        amount_str = f"{float(amount):.2f}"
        form_data = {
            "merchant_id": pf_creds["merchant_id"], "merchant_key": pf_creds["merchant_key"],
            "return_url": f"{base_url}/payment/return?booking_id={booking_id}",
            "cancel_url": f"{base_url}/payment/cancel?booking_id={booking_id}",
            "notify_url": f"{base_url}/api/payments/payfast-itn",
            "name_first": first_name, "name_last": last_name,
            "email_address": booking.get("client_email", ""),
            "m_payment_id": booking_id, "amount": amount_str,
            "item_name": f"{booking.get('session_type', 'Photography').title()} Session",
            "item_description": f"{booking.get('package_name', 'Package')} - {'Deposit' if payment_type == 'deposit' else 'Full Payment'}",
        }
        if cell_number and len(cell_number) == 10:
            form_data["cell_number"] = cell_number
        form_data["signature"] = calculate_payfast_signature_with_creds(form_data, pf_creds["passphrase"])

        return {"payment_method": "payfast", "payment_url": pf_creds["url"],
                "form_data": form_data, "amount": amount, "is_sandbox": pf_creds["is_sandbox"]}

    elif payment_method == "eft":
        settings = await db.payment_settings.find_one({"id": "default"}, {"_id": 0})
        reference = settings.get("reference_format", "BOOKING-{booking_id}").replace("{booking_id}", booking_id[:8].upper())
        return {"payment_method": "eft", "bank_details": {
            "bank_name": settings.get("bank_name", ""), "account_holder": settings.get("account_holder", ""),
            "account_number": settings.get("account_number", ""), "branch_code": settings.get("branch_code", ""),
            "account_type": settings.get("account_type", ""), "reference": reference
        }, "amount": amount}

    elif payment_method == "payflex":
        return {"payment_method": "payflex", "message": "PayFlex integration coming soon", "amount": amount}
    else:
        raise HTTPException(status_code=400, detail="Invalid payment method")


# ==================== PAYMENT STATUS / VERIFY ====================

@router.get("/payments/status/{booking_id}")
async def get_payment_status(booking_id: str):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {
        "booking_id": booking_id, "status": booking.get("status"),
        "payment_status": booking.get("payment_status"), "payment_method": booking.get("payment_method"),
        "payment_type": booking.get("payment_type"), "amount_paid": booking.get("amount_paid", 0),
        "total_price": booking.get("total_price", 0), "session_type": booking.get("session_type", ""),
        "package_name": booking.get("package_name", ""),
        "manage_token": booking.get("manage_token", booking.get("token", ""))
    }

@router.post("/payments/verify")
async def verify_payment_with_payfast(data: dict):
    booking_id = data.get("booking_id")
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.get("payment_status") == "complete" or booking.get("status") == "confirmed":
        return {"verified": True, "status": "complete", "message": "Payment already confirmed"}

    if booking.get("payment_method") != "payfast":
        return {"verified": False, "status": booking.get("payment_status", "unknown"), "message": "Not a PayFast payment"}

    pf_creds = await get_payfast_credentials()
    try:
        validate_url = "https://sandbox.payfast.co.za/eng/query/validate" if pf_creds["is_sandbox"] else "https://www.payfast.co.za/eng/query/validate"
        verify_data = {"merchant_id": pf_creds["merchant_id"], "merchant_key": pf_creds["merchant_key"], "m_payment_id": booking_id}
        pf_string = "&".join([f"{k}={urllib.parse.quote_plus(str(v))}" for k, v in verify_data.items()])
        if pf_creds["passphrase"]:
            pf_string += f"&passphrase={urllib.parse.quote_plus(pf_creds['passphrase'])}"
        signature = hashlib.md5(pf_string.encode()).hexdigest()
        verify_data["signature"] = signature

        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(validate_url, data=verify_data, timeout=10.0)
            if response.status_code == 200:
                result = {}
                for pair in response.text.split("&"):
                    if "=" in pair:
                        key, value = pair.split("=", 1)
                        result[key] = urllib.parse.unquote_plus(value)
                payment_status = result.get("payment_status", "").upper()
                if payment_status == "COMPLETE":
                    total_price = booking.get("total_price", 0)
                    payment_type = booking.get("payment_type", "deposit")
                    amount_paid = total_price if payment_type == "full" else int(total_price * 0.5)
                    await db.bookings.update_one(
                        {"id": booking_id},
                        {"$set": {"payment_status": "complete", "status": "confirmed",
                                   "amount_paid": amount_paid, "pf_payment_id": result.get("pf_payment_id", ""),
                                   "updated_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    return {"verified": True, "status": "complete", "message": "Payment verified successfully"}
                else:
                    return {"verified": False, "status": payment_status.lower() if payment_status else "pending",
                            "message": f"Payment status: {payment_status or 'PENDING'}"}
            else:
                return {"verified": False, "status": "unknown", "message": "Could not verify with PayFast"}
    except Exception as e:
        logger.error(f"PayFast verification error: {str(e)}")
        return {"verified": False, "status": "error", "message": "Verification failed - please contact support"}


# ==================== PAYMENT REMINDER ====================

@router.post("/payments/send-reminder")
async def send_payment_reminder(data: dict, admin=Depends(verify_token)):
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail
    booking_id = data.get("booking_id")
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    frontend_url = os.environ.get('REACT_APP_BACKEND_URL', '').replace('/api', '')
    payment_link = f"{frontend_url}/complete-payment/{booking_id}"

    try:
        html_content = f"""
        <html><body style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FDFCF8;">
            <div style="text-align: center; padding: 30px 0; border-bottom: 2px solid #C6A87C;">
                <h1 style="color: #2D2A26; font-size: 28px; margin: 0;">Silwer Lining Photography</h1>
            </div>
            <div style="padding: 30px 0;">
                <h2 style="color: #2D2A26;">Payment Reminder</h2>
                <p>Dear {booking['client_name']},</p>
                <p>This is a friendly reminder to complete your payment.</p>
                <div style="background-color: #F5F2EE; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Session:</strong> {booking['session_type'].title()}</p>
                    <p><strong>Package:</strong> {booking['package_name']}</p>
                    <p><strong>Date:</strong> {booking['booking_date']}</p>
                    <p><strong>Time:</strong> {booking['booking_time']}</p>
                    <p><strong>Total:</strong> R{booking.get('total_price', 0):,.2f}</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{payment_link}" style="background-color: #C6A87C; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">Complete Payment</a>
                </div>
            </div>
        </body></html>
        """
        message = Mail(from_email=SENDER_EMAIL, to_emails=booking['client_email'],
                       subject=f"Payment Reminder - {booking['session_type'].title()} Session", html_content=html_content)
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        sg.send(message)
        return {"message": "Payment reminder sent"}
    except Exception as e:
        logger.error(f"Failed to send payment reminder: {e}")
        raise HTTPException(status_code=500, detail="Failed to send reminder")
