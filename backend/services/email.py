import os
import base64
from datetime import datetime, timezone
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
import httpx
from db import db, SENDGRID_API_KEY, SENDER_EMAIL, logger


def send_booking_confirmation_email(booking: dict):
    """Send booking confirmation email via SendGrid"""
    try:
        if not SENDGRID_API_KEY:
            logger.warning("SendGrid API key not configured")
            return False

        frontend_url = os.environ.get('REACT_APP_BACKEND_URL', '').replace('/api', '')
        manage_token = booking.get('manage_token') or booking.get('token', '')
        manage_link = f"{frontend_url}/manage/{manage_token}" if manage_token else ""

        html_content = f"""
        <html>
        <body style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FDFCF8;">
            <div style="text-align: center; padding: 30px 0; border-bottom: 2px solid #C6A87C;">
                <h1 style="color: #2D2A26; font-size: 28px; margin: 0;">Silwer Lining Photography</h1>
                <p style="color: #8A847C; margin-top: 8px;">More than photos — capturing the glow, the love and the memory</p>
            </div>
            <div style="padding: 30px 0;">
                <h2 style="color: #2D2A26; font-size: 22px;">Booking Confirmed!</h2>
                <p style="color: #2D2A26; line-height: 1.8;">Dear {booking['client_name']},</p>
                <p style="color: #2D2A26; line-height: 1.8;">Thank you for your booking! We're excited to capture your special moments.</p>
                <div style="background-color: #F5F2EE; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #2D2A26; margin-top: 0;">Booking Details</h3>
                    <p style="margin: 8px 0;"><strong>Session Type:</strong> {booking['session_type'].replace('-', ' ').title()}</p>
                    <p style="margin: 8px 0;"><strong>Package:</strong> {booking['package_name']}</p>
                    <p style="margin: 8px 0;"><strong>Price:</strong> R{booking.get('total_price', booking.get('package_price', 0)):,}</p>
                    <p style="margin: 8px 0;"><strong>Date:</strong> {booking['booking_date']}</p>
                    <p style="margin: 8px 0;"><strong>Time:</strong> {booking['booking_time']}</p>
                </div>
                {f'''<div style="background-color: #E8F5E9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                    <p style="margin: 0 0 15px 0; color: #2D2A26;"><strong>Manage Your Booking</strong></p>
                    <p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">Complete your questionnaire, reschedule or make changes</p>
                    <a href="{manage_link}" style="background-color: #A69F95; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Manage Booking</a>
                </div>''' if manage_link else ""}
                <p style="color: #2D2A26; line-height: 1.8;"><strong>Studio Location:</strong><br>Helderkruin, Roodepoort<br>Johannesburg, Gauteng</p>
                <p style="color: #2D2A26; line-height: 1.8;">If you have any questions, please don't hesitate to reach out via WhatsApp at 063 699 9703 or email info@silwerlining.co.za</p>
                <p style="color: #2D2A26; line-height: 1.8; margin-top: 30px;">Warm regards,<br><strong>Nadia</strong><br>Silwer Lining Photography</p>
            </div>
            <div style="border-top: 1px solid #E6E2DD; padding-top: 20px; text-align: center; color: #8A847C; font-size: 12px;">
                <p>&copy; 2026 Silwer Lining Photography. All rights reserved.</p>
                <p>Helderkruin, Roodepoort, Johannesburg</p>
            </div>
        </body>
        </html>
        """

        message = Mail(
            from_email=SENDER_EMAIL,
            to_emails=booking['client_email'],
            subject=f"Booking Confirmed - {booking['session_type'].replace('-', ' ').title()} Session",
            html_content=html_content
        )
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        logger.info(f"Email sent to {booking['client_email']}, status: {response.status_code}")
        return response.status_code == 202
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return False


async def send_contract_email(booking: dict, pdf_bytes: bytes, admin_email: str = None):
    """Send the signed contract PDF to client and CC to admin"""
    try:
        if not SENDGRID_API_KEY:
            logger.warning("SendGrid API key not configured")
            return False

        html_content = f"""
        <html>
        <body style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FDFCF8;">
            <div style="text-align: center; padding: 30px 0; border-bottom: 2px solid #C6A87C;">
                <h1 style="color: #2D2A26; font-size: 28px; margin: 0;">Silwer Lining Photography</h1>
                <p style="color: #8A847C; margin-top: 8px;">More than photos — capturing the glow, the love and the memory</p>
            </div>
            <div style="padding: 30px 0;">
                <h2 style="color: #2D2A26; font-size: 22px;">Signed Contract</h2>
                <p style="color: #2D2A26; line-height: 1.8;">Dear {booking['client_name']},</p>
                <p style="color: #2D2A26; line-height: 1.8;">Thank you for signing the photography session contract. Please find your copy attached to this email.</p>
                <div style="background-color: #F5F2EE; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #2D2A26; margin-top: 0;">Booking Details</h3>
                    <p style="margin: 8px 0;"><strong>Session Type:</strong> {booking['session_type'].title()}</p>
                    <p style="margin: 8px 0;"><strong>Package:</strong> {booking['package_name']}</p>
                    <p style="margin: 8px 0;"><strong>Date:</strong> {booking['booking_date']}</p>
                    <p style="margin: 8px 0;"><strong>Time:</strong> {booking['booking_time']}</p>
                </div>
                <p style="color: #2D2A26; line-height: 1.8;">Please keep this email for your records.</p>
                <p style="color: #2D2A26; line-height: 1.8; margin-top: 30px;">Warm regards,<br><strong>Nadia</strong><br>Silwer Lining Photography</p>
            </div>
            <div style="border-top: 1px solid #E6E2DD; padding-top: 20px; text-align: center; color: #8A847C; font-size: 12px;">
                <p>&copy; 2026 Silwer Lining Photography. All rights reserved.</p>
            </div>
        </body>
        </html>
        """

        message = Mail(
            from_email=SENDER_EMAIL,
            to_emails=booking['client_email'],
            subject=f"Signed Contract - {booking['session_type'].title()} Session",
            html_content=html_content
        )
        if admin_email:
            message.add_cc(admin_email)
        if pdf_bytes:
            encoded_pdf = base64.b64encode(pdf_bytes).decode()
            attachment = Attachment(
                FileContent(encoded_pdf),
                FileName(f"contract_{booking['client_name'].replace(' ', '_')}_{booking['booking_date']}.pdf"),
                FileType('application/pdf'),
                Disposition('attachment')
            )
            message.attachment = attachment

        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        logger.info(f"Contract email sent to {booking['client_email']}, status: {response.status_code}")
        return response.status_code == 202
    except Exception as e:
        logger.error(f"Failed to send contract email: {str(e)}")
        return False


async def send_manual_booking_email(booking: dict, token: str):
    """Send email to client with link to complete their booking"""
    if not SENDGRID_API_KEY:
        logger.warning("SendGrid not configured, skipping manual booking email")
        return

    booking_link = f"https://silwerlining.co.za/complete-booking/{token}"

    html_content = f"""
    <div style="font-family: 'Manrope', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #C6A87C; font-family: 'Playfair Display', serif;">Silwer Lining Photography</h1>
        </div>
        <p>Hi {booking['client_name']},</p>
        <p>We're excited to have you! A session has been reserved for you:</p>
        <div style="background-color: #FDFCF8; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <p><strong>Session Type:</strong> {booking['session_type'].title()}</p>
            <p><strong>Date:</strong> {booking['booking_date']}</p>
            <p><strong>Time:</strong> {booking['booking_time']}</p>
        </div>
        <p>Please click the button below to complete your booking:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{booking_link}" style="background-color: #C6A87C; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">Complete Your Booking</a>
        </div>
        <p style="color: #666; font-size: 14px;">This link will expire in 7 days.</p>
        <p>With love,<br>Silwer Lining Photography</p>
    </div>
    """

    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        message = Mail(
            from_email=SENDER_EMAIL,
            to_emails=booking['client_email'],
            subject="Complete Your Photography Session Booking - Silwer Lining",
            html_content=html_content
        )
        sg.send(message)
        logger.info(f"Manual booking email sent to {booking['client_email']}")
    except Exception as e:
        logger.error(f"Failed to send manual booking email: {e}")


async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send email using configured provider (Microsoft Graph or SendGrid)"""
    try:
        settings = await db.email_settings.find_one({"id": "default"}, {"_id": 0})
        provider = settings.get("provider", "sendgrid") if settings else "sendgrid"

        if provider == "microsoft" and settings:
            return await send_email_microsoft(to_email, subject, html_content, settings)
        else:
            return await send_email_sendgrid(to_email, subject, html_content, settings)
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return False


async def send_email_microsoft(to_email: str, subject: str, html_content: str, settings: dict) -> bool:
    """Send email via Microsoft Graph API"""
    tenant_id = settings.get("microsoft_tenant_id")
    client_id = settings.get("microsoft_client_id")
    client_secret = settings.get("microsoft_client_secret")
    sender_email = settings.get("microsoft_sender_email")

    if not all([tenant_id, client_id, client_secret, sender_email]):
        logger.error("Microsoft Graph: Missing configuration")
        return False

    try:
        token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
        token_data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials"
        }

        async with httpx.AsyncClient() as http_client:
            token_response = await http_client.post(token_url, data=token_data)
            if token_response.status_code != 200:
                logger.error(f"Microsoft Graph token error: {token_response.text}")
                return False

            access_token = token_response.json().get("access_token")
            send_url = f"https://graph.microsoft.com/v1.0/users/{sender_email}/sendMail"
            email_data = {
                "message": {
                    "subject": subject,
                    "body": {"contentType": "HTML", "content": html_content},
                    "toRecipients": [{"emailAddress": {"address": to_email}}]
                },
                "saveToSentItems": "true"
            }
            headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
            send_response = await http_client.post(send_url, json=email_data, headers=headers)

            if send_response.status_code in [200, 202]:
                logger.info(f"Microsoft Graph: Email sent to {to_email}")
                return True
            else:
                logger.error(f"Microsoft Graph send error: {send_response.status_code} - {send_response.text}")
                return False
    except Exception as e:
        logger.error(f"Microsoft Graph exception: {e}")
        return False


async def send_email_sendgrid(to_email: str, subject: str, html_content: str, settings: dict = None) -> bool:
    """Send email via SendGrid"""
    api_key = settings.get("sendgrid_api_key") if settings else None
    sender_email = settings.get("sendgrid_sender_email") if settings else None
    sender_name = settings.get("sendgrid_sender_name", "Silwer Lining Photography") if settings else "Silwer Lining Photography"

    if not api_key:
        api_key = SENDGRID_API_KEY
    if not sender_email:
        sender_email = SENDER_EMAIL

    if not api_key:
        logger.error("SendGrid: No API key configured")
        return False

    try:
        message = Mail(
            from_email=(sender_email, sender_name) if sender_name else sender_email,
            to_emails=to_email,
            subject=subject,
            html_content=html_content
        )
        sg = SendGridAPIClient(api_key)
        response = sg.send(message)
        logger.info(f"SendGrid: Email sent to {to_email}, status: {response.status_code}")
        return response.status_code in [200, 202]
    except Exception as e:
        logger.error(f"SendGrid error: {e}")
        return False
