from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response, RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
import httpx
import caldav
from icalendar import Calendar as ICalendar, Event as ICalEvent
import base64
import io
import hashlib
import urllib.parse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# PayFast configuration
PAYFAST_MERCHANT_ID = os.environ.get('PAYFAST_MERCHANT_ID', '')
PAYFAST_MERCHANT_KEY = os.environ.get('PAYFAST_MERCHANT_KEY', '')
PAYFAST_PASSPHRASE = os.environ.get('PAYFAST_PASSPHRASE', '')
PAYFAST_SANDBOX = os.environ.get('PAYFAST_SANDBOX', 'true').lower() == 'true'
PAYFAST_URL = "https://sandbox.payfast.co.za/eng/process" if PAYFAST_SANDBOX else "https://www.payfast.co.za/eng/process"

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'default_secret')
JWT_ALGORITHM = "HS256"

# SendGrid Config
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'info@silwerlining.co.za')

# Apple Calendar Config
APPLE_CALENDAR_URL = os.environ.get('APPLE_CALENDAR_URL', '')
APPLE_CALENDAR_USER = os.environ.get('APPLE_CALENDAR_USER', '')
APPLE_CALENDAR_PASSWORD = os.environ.get('APPLE_CALENDAR_PASSWORD', '')

async def get_payfast_credentials():
    """Get PayFast credentials from database settings, fallback to environment variables"""
    try:
        settings = await db.payment_settings.find_one({"id": "default"})
        if settings:
            is_sandbox = settings.get("payfast_sandbox", True)
            if is_sandbox:
                merchant_id = settings.get("payfast_sandbox_merchant_id") or PAYFAST_MERCHANT_ID
                merchant_key = settings.get("payfast_sandbox_merchant_key") or PAYFAST_MERCHANT_KEY
                passphrase = settings.get("payfast_sandbox_passphrase") or PAYFAST_PASSPHRASE
                url = "https://sandbox.payfast.co.za/eng/process"
            else:
                merchant_id = settings.get("payfast_merchant_id") or PAYFAST_MERCHANT_ID
                merchant_key = settings.get("payfast_merchant_key") or PAYFAST_MERCHANT_KEY
                passphrase = settings.get("payfast_passphrase") or PAYFAST_PASSPHRASE
                url = "https://www.payfast.co.za/eng/process"
            return {
                "merchant_id": merchant_id,
                "merchant_key": merchant_key,
                "passphrase": passphrase,
                "is_sandbox": is_sandbox,
                "url": url
            }
    except Exception as e:
        logger.error(f"Error getting PayFast credentials: {e}")
    
    # Fallback to environment variables
    return {
        "merchant_id": PAYFAST_MERCHANT_ID,
        "merchant_key": PAYFAST_MERCHANT_KEY,
        "passphrase": PAYFAST_PASSPHRASE,
        "is_sandbox": PAYFAST_SANDBOX,
        "url": PAYFAST_URL
    }

app = FastAPI(title="Silwer Lining Photography API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class PackageCreate(BaseModel):
    name: str
    session_type: str  # maternity, newborn, studio, baby-birthday, family, etc.
    price: int
    duration: str
    includes: List[str]
    description: Optional[str] = ""
    popular: bool = False
    active: bool = True

class Package(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    session_type: str
    price: int
    duration: str
    includes: List[str]
    description: str = ""
    popular: bool = False
    active: bool = True
    order: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BookingSettingsUpdate(BaseModel):
    available_days: List[int] = [1, 2, 3, 4, 5, 6]  # 0=Sun, 1=Mon, ..., 6=Sat
    time_slots: List[str] = []  # Legacy flat list (kept for backwards compatibility)
    time_slot_schedule: dict = {}  # New: { sessionType: { dayId: ["09:00", "13:00"], ... }, ... }
    buffer_minutes: int = 30  # Buffer between sessions
    min_lead_days: int = 3  # Minimum days before booking
    max_advance_days: int = 90  # Maximum days in advance
    blocked_dates: List[str] = []  # Specific dates blocked
    weekend_surcharge: int = 750  # ZAR for weekends
    session_duration_default: int = 120  # Default 2 hours

class BookingSettings(BaseModel):
    id: str = "default"
    available_days: List[int] = [1, 2, 3, 4, 5, 6]
    time_slots: List[str] = []  # Legacy
    time_slot_schedule: dict = {}  # New flexible schedule
    buffer_minutes: int = 30
    min_lead_days: int = 3
    max_advance_days: int = 90
    blocked_dates: List[str] = []
    weekend_surcharge: int = 750
    session_duration_default: int = 120

class BookingCreate(BaseModel):
    client_name: str
    client_email: EmailStr
    client_phone: str
    session_type: str
    package_id: str
    package_name: str
    package_price: int
    booking_date: str
    booking_time: str
    notes: Optional[str] = ""
    # Add-ons and pricing
    selected_addons: List[str] = []
    addons_total: int = 0
    is_weekend: bool = False
    weekend_surcharge: int = 0
    total_price: int = 0
    # Questionnaire responses
    questionnaire_responses: dict = {}
    # Contract data
    contract_signed: bool = False
    contract_data: dict = {}  # {field_responses, signature_data, signed_at}
    # Payment data
    payment_method: str = ""  # payfast, payflex, eft, none
    payment_type: str = ""  # deposit, full
    
class PaymentSettings(BaseModel):
    """Admin payment configuration"""
    id: str = "default"
    # Bank details for EFT
    bank_name: str = ""
    account_holder: str = ""
    account_number: str = ""
    branch_code: str = ""
    account_type: str = ""  # Savings, Cheque
    reference_format: str = "BOOKING-{booking_id}"
    # PayFlex credentials (for future)
    payflex_api_key: str = ""
    payflex_enabled: bool = False
    # PayFast settings
    payfast_enabled: bool = True
    payfast_sandbox: bool = True
    # Sandbox credentials
    payfast_sandbox_merchant_id: str = ""
    payfast_sandbox_merchant_key: str = ""
    payfast_sandbox_passphrase: str = ""
    # Live credentials
    payfast_merchant_id: str = ""
    payfast_merchant_key: str = ""
    payfast_passphrase: str = ""
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BookingUpdate(BaseModel):
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    session_type: Optional[str] = None
    package_id: Optional[str] = None
    package_name: Optional[str] = None
    package_price: Optional[int] = None
    booking_date: Optional[str] = None
    booking_time: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    admin_notes: Optional[str] = None

class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    client_email: str
    client_phone: str
    session_type: str
    package_id: str
    package_name: str
    package_price: int
    booking_date: str
    booking_time: str
    notes: str = ""
    admin_notes: str = ""
    status: str = "pending"  # pending, confirmed, completed, cancelled, rescheduled, awaiting_payment, awaiting_eft
    calendar_event_id: Optional[str] = None
    # Add-ons and pricing
    selected_addons: List[str] = []
    addons_total: int = 0
    is_weekend: bool = False
    weekend_surcharge: int = 0
    total_price: int = 0
    # Questionnaire responses
    questionnaire_responses: dict = {}  # {question_id: answer}
    questionnaire_completed: bool = False
    questionnaire_reminder_sent: bool = False
    # Contract data
    contract_signed: bool = False
    contract_data: dict = {}  # {field_responses, signature_data, signed_at}
    # Payment data
    payment_method: str = ""  # payfast, payflex, eft, none
    payment_status: str = ""  # pending, complete, failed
    payment_type: str = ""  # deposit, full
    amount_paid: int = 0
    payment_reference: str = ""
    payment_id: str = ""
    # Client management token
    manage_token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CalendarSettings(BaseModel):
    apple_calendar_url: str = ""
    apple_calendar_user: str = ""
    apple_calendar_password: str = ""
    sync_enabled: bool = False

# ==================== MANUAL BOOKING MODELS ====================

class ManualBookingCreate(BaseModel):
    """Admin creates a placeholder booking, sends link to client"""
    client_name: str
    client_email: EmailStr
    client_phone: str = ""
    session_type: str
    booking_date: str
    booking_time: str
    notes: str = ""

class ManualBookingToken(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    booking_id: str
    token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    expires_at: str = ""
    used: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BlockedSlot(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    time: str
    reason: str = "Blocked"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CustomSlot(BaseModel):
    """Custom available slot added for a specific date"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    time: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ==================== CONTRACT MODELS ====================

class ContractSmartField(BaseModel):
    """A smart field that can be inserted into the contract"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # "agree_disagree", "initials", "signature", "date"
    label: str  # Label shown to client
    required: bool = True

class ContractTemplate(BaseModel):
    """The contract template that admin can edit"""
    id: str = "default"
    content: str = ""  # HTML content with {{FIELD_ID}} placeholders
    smart_fields: List[dict] = []  # List of smart field definitions
    title: str = "Photography Session Contract"
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SignedContractData(BaseModel):
    """Data from a signed contract"""
    field_responses: dict = {}  # {field_id: value} - for agree/disagree and initials
    signature_data: str = ""  # Base64 encoded signature image
    signed_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    client_name: str = ""
    client_email: str = ""

# ==================== ADD-ONS MODELS ====================

class AddOnCreate(BaseModel):
    name: str
    description: str = ""
    price: int
    categories: List[str] = []  # Which session types this add-on applies to
    active: bool = True

class AddOn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    price: int
    categories: List[str] = []
    active: bool = True
    order: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ==================== EMAIL TEMPLATE MODELS ====================

class EmailTemplateCreate(BaseModel):
    name: str  # e.g., "booking_confirmation", "booking_reminder", "booking_cancellation"
    subject: str
    html_content: str
    use_raw_html: bool = False
    active: bool = True

class EmailTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    display_name: str = ""
    subject: str
    html_content: str
    use_raw_html: bool = False
    active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ==================== STORAGE SETTINGS MODELS ====================

class StorageSettingsUpdate(BaseModel):
    provider: str = "cloudflare_r2"  # cloudflare_r2, aws_s3, local
    account_id: str = ""
    access_key_id: str = ""
    secret_access_key: str = ""
    bucket_name: str = ""
    public_url: str = ""  # Public URL for accessing files

# ==================== INSTAGRAM SETTINGS MODELS ====================

class InstagramSettingsUpdate(BaseModel):
    access_token: str = ""
    enabled: bool = True
    post_count: int = 6

# ==================== QUESTIONNAIRE MODELS ====================

class QuestionOption(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    value: str = ""

class Question(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # text, textarea, radio, checkbox, dropdown, date, time, number, email, phone
    label: str
    description: str = ""
    required: bool = False
    options: List[QuestionOption] = []  # For radio, checkbox, dropdown
    placeholder: str = ""
    validation: dict = {}  # min, max, pattern, etc.
    order: int = 0

class QuestionnaireCreate(BaseModel):
    session_type: str
    title: str = ""
    description: str = ""
    questions: List[Question] = []
    active: bool = True

class Questionnaire(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_type: str  # maternity, newborn, family, etc.
    title: str = ""
    description: str = ""
    questions: List[Question] = []
    active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PortfolioCreate(BaseModel):
    title: str
    category: str
    image_url: str
    description: Optional[str] = ""
    featured: bool = False

class Portfolio(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    category: str
    image_url: str
    description: str = ""
    featured: bool = False
    order: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class TestimonialCreate(BaseModel):
    client_name: str
    session_type: str
    content: str
    rating: int = 5
    image_url: Optional[str] = ""

class Testimonial(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    session_type: str
    content: str
    rating: int = 5
    image_url: str = ""
    approved: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ==================== FAQ MODELS ====================

class FAQCreate(BaseModel):
    question: str
    answer: str
    category: str = "general"  # general, booking, pricing, session, etc.
    order: int = 0
    active: bool = True

class FAQ(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question: str
    answer: str
    category: str = "general"
    order: int = 0
    active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ContactMessageCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = ""
    subject: str
    message: str

class ContactMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str = ""
    subject: str
    message: str
    read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class AdminLogin(BaseModel):
    email: str
    password: str

class AdminCreate(BaseModel):
    email: str
    password: str
    name: str

# ==================== EMAIL SERVICE ====================

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
                    <a href="{manage_link}" style="background-color: #A69F95; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        Manage Booking
                    </a>
                </div>''' if manage_link else ""}
                
                <p style="color: #2D2A26; line-height: 1.8;">
                    <strong>Studio Location:</strong><br>
                    Helderkruin, Roodepoort<br>
                    Johannesburg, Gauteng
                </p>
                
                <p style="color: #2D2A26; line-height: 1.8;">If you have any questions, please don't hesitate to reach out via WhatsApp at 063 699 9703 or email info@silwerlining.co.za</p>
                
                <p style="color: #2D2A26; line-height: 1.8; margin-top: 30px;">
                    Warm regards,<br>
                    <strong>Nadia</strong><br>
                    Silwer Lining Photography
                </p>
            </div>
            
            <div style="border-top: 1px solid #E6E2DD; padding-top: 20px; text-align: center; color: #8A847C; font-size: 12px;">
                <p>© 2026 Silwer Lining Photography. All rights reserved.</p>
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

async def generate_contract_pdf(booking: dict, contract_template: dict) -> bytes:
    """Generate a PDF of the signed contract"""
    try:
        from weasyprint import HTML, CSS
        
        contract_data = booking.get("contract_data", {})
        field_responses = contract_data.get("field_responses", {})
        signature_data = contract_data.get("signature_data", "")
        signed_at = contract_data.get("signed_at", "")
        
        # Start with the contract content
        content = contract_template.get("content", "")
        smart_fields = contract_template.get("smart_fields", [])
        
        # Replace smart fields with actual values
        for field in smart_fields:
            field_id = field.get("id")
            field_type = field.get("type")
            placeholder = "{{" + field_id + "}}"
            
            if field_type == "agree_disagree":
                value = field_responses.get(field_id, False)
                replacement = f'<span style="font-weight: bold; color: {"green" if value else "red"};">{"✓ AGREED" if value else "✗ NOT AGREED"}</span>'
            elif field_type == "initials":
                value = field_responses.get(field_id, "")
                replacement = f'<span style="font-family: cursive; font-size: 18px; border-bottom: 1px solid #000; padding: 2px 10px;">{value}</span>'
            elif field_type == "date":
                replacement = f'<span style="border-bottom: 1px solid #000; padding: 2px 10px;">{signed_at[:10] if signed_at else datetime.now().strftime("%Y-%m-%d")}</span>'
            elif field_type == "signature":
                if signature_data:
                    replacement = f'<img src="{signature_data}" style="max-width: 300px; max-height: 100px; border-bottom: 1px solid #000;" />'
                else:
                    replacement = '<span style="border-bottom: 1px solid #000; width: 200px; display: inline-block;">&nbsp;</span>'
            else:
                replacement = field_responses.get(field_id, "")
            
            content = content.replace(placeholder, replacement)
        
        # Create full HTML document
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    font-family: 'Georgia', serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 40px;
                    line-height: 1.6;
                    color: #2D2A26;
                }}
                h1, h2, h3 {{
                    color: #2D2A26;
                }}
                .header {{
                    text-align: center;
                    border-bottom: 2px solid #C6A87C;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }}
                .header h1 {{
                    color: #C6A87C;
                    font-size: 28px;
                    margin: 0;
                }}
                .contract-content {{
                    margin-bottom: 30px;
                }}
                .footer {{
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #E6E2DD;
                    font-size: 12px;
                    color: #8A847C;
                    text-align: center;
                }}
                .booking-info {{
                    background-color: #F5F2EE;
                    padding: 15px;
                    border-radius: 5px;
                    margin-bottom: 20px;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Silwer Lining Photography</h1>
                <p>Photography Session Contract</p>
            </div>
            
            <div class="booking-info">
                <strong>Client:</strong> {booking.get('client_name', '')}<br>
                <strong>Email:</strong> {booking.get('client_email', '')}<br>
                <strong>Session Type:</strong> {booking.get('session_type', '').title()}<br>
                <strong>Package:</strong> {booking.get('package_name', '')}<br>
                <strong>Date:</strong> {booking.get('booking_date', '')}<br>
                <strong>Time:</strong> {booking.get('booking_time', '')}
            </div>
            
            <div class="contract-content">
                {content}
            </div>
            
            <div class="footer">
                <p>Contract signed on: {signed_at[:10] if signed_at else 'N/A'}</p>
                <p>© 2026 Silwer Lining Photography. All rights reserved.</p>
                <p>Helderkruin, Roodepoort, Johannesburg</p>
            </div>
        </body>
        </html>
        """
        
        # Generate PDF
        pdf_bytes = HTML(string=html_content).write_pdf()
        return pdf_bytes
        
    except Exception as e:
        logger.error(f"Failed to generate contract PDF: {str(e)}")
        return None

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
                
                <p style="color: #2D2A26; line-height: 1.8;">Please keep this email for your records. If you have any questions, feel free to contact us.</p>
                
                <p style="color: #2D2A26; line-height: 1.8; margin-top: 30px;">
                    Warm regards,<br>
                    <strong>Nadia</strong><br>
                    Silwer Lining Photography
                </p>
            </div>
            
            <div style="border-top: 1px solid #E6E2DD; padding-top: 20px; text-align: center; color: #8A847C; font-size: 12px;">
                <p>© 2026 Silwer Lining Photography. All rights reserved.</p>
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
        
        # Add CC to admin if provided
        if admin_email:
            message.add_cc(admin_email)
        
        # Attach PDF
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

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(email: str) -> str:
    payload = {
        "sub": email,
        "exp": datetime.now(timezone.utc).timestamp() + 86400  # 24 hours
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get("sub")
        admin = await db.admins.find_one({"email": email}, {"_id": 0})
        if not admin:
            raise HTTPException(status_code=401, detail="Invalid token")
        return admin
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== PUBLIC ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "Silwer Lining Photography API"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# ==================== PACKAGES (Public) ====================

@api_router.get("/packages")
async def get_packages(session_type: Optional[str] = None, active_only: bool = True):
    """Get all packages, optionally filtered by session type"""
    query = {}
    if session_type:
        query["session_type"] = session_type
    if active_only:
        query["active"] = True
    
    packages = await db.packages.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    
    # If no packages in DB, return defaults
    if not packages:
        return get_default_packages(session_type)
    
    return packages

def get_default_packages(session_type: Optional[str] = None):
    """Return default packages if none in database"""
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

@api_router.get("/booking-settings")
async def get_booking_settings_public():
    """Get public booking settings"""
    settings = await db.booking_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        settings = BookingSettings().model_dump()
    return settings

@api_router.get("/bookings/available-times")
async def get_available_times(date: str, session_type: Optional[str] = None):
    """Get available time slots for a date and optionally filtered by session type"""
    # Get booking settings
    settings = await db.booking_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        settings = BookingSettings().model_dump()
    
    # Check if date is blocked
    if date in settings.get("blocked_dates", []):
        return {"date": date, "available_times": [], "message": "This date is not available"}
    
    # Parse date and get day of week
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        day_of_week = date_obj.weekday()  # 0=Monday, 6=Sunday
        # Convert to our format (0=Sunday, 1=Monday, etc.)
        day_id = (day_of_week + 1) % 7
        is_weekend = day_id in [0, 6]
    except ValueError:
        return {"date": date, "available_times": [], "message": "Invalid date format"}
    
    # Get time slots based on flexible schedule
    time_slot_schedule = settings.get("time_slot_schedule", {})
    all_times = []
    
    if session_type and time_slot_schedule.get(session_type):
        # Use session-type specific schedule
        session_schedule = time_slot_schedule[session_type]
        all_times = session_schedule.get(str(day_id), [])
    elif time_slot_schedule:
        # If no session type specified but schedule exists, collect all unique slots for this day
        for st, schedule in time_slot_schedule.items():
            day_slots = schedule.get(str(day_id), [])
            all_times.extend([s for s in day_slots if s not in all_times])
        all_times = sorted(list(set(all_times)))
    
    # Check for custom slots for this specific date
    custom_slots = await db.custom_slots.find({"date": date}, {"_id": 0}).to_list(50)
    for cs in custom_slots:
        if cs["time"] not in all_times:
            all_times.append(cs["time"])
    all_times = sorted(list(set(all_times)))
    
    # If no time slots configured for this day, it's not available
    if not all_times:
        return {"date": date, "available_times": [], "message": "No time slots available for this day", "is_weekend": is_weekend}
    
    # Get booked times for the date
    booked = await db.bookings.find(
        {"booking_date": date, "status": {"$nin": ["cancelled"]}},
        {"_id": 0, "booking_time": 1}
    ).to_list(100)
    booked_times = [b["booking_time"] for b in booked]
    
    # Check Apple Calendar for blocked times (2-way sync)
    calendar_blocked_times = await get_calendar_blocked_times(date, all_times)
    
    # Combine booked times and calendar blocked times
    unavailable_times = set(booked_times + calendar_blocked_times)
    available = [t for t in all_times if t not in unavailable_times]
    
    return {
        "date": date,
        "available_times": available,
        "is_weekend": is_weekend,
        "weekend_surcharge": settings.get("weekend_surcharge", 750) if is_weekend else 0,
        "session_type": session_type,
        "calendar_blocked": len(calendar_blocked_times) > 0
    }

# ==================== BOOKINGS (Public Create) ====================

@api_router.post("/bookings")
async def create_booking(booking_data: BookingCreate, background_tasks: BackgroundTasks):
    """Create a new booking and send confirmation email"""
    booking = Booking(**booking_data.model_dump())
    doc = booking.model_dump()
    await db.bookings.insert_one(doc)
    
    # Send confirmation email in background
    background_tasks.add_task(send_booking_confirmation_email, doc)
    
    # Create calendar event in background (if sync enabled)
    background_tasks.add_task(create_calendar_event_background, doc)
    
    # If contract was signed, generate and send contract PDF
    if doc.get("contract_signed"):
        background_tasks.add_task(send_contract_pdf_background, doc)
    
    return booking

async def send_contract_pdf_background(booking_dict: dict):
    """Background task to generate and send contract PDF"""
    try:
        # Get contract template
        contract_template = await db.contract_template.find_one({"id": "default"}, {"_id": 0})
        if not contract_template:
            logger.warning("No contract template found")
            return
        
        # Generate PDF
        pdf_bytes = await generate_contract_pdf(booking_dict, contract_template)
        if not pdf_bytes:
            logger.error("Failed to generate contract PDF")
            return
        
        # Get admin email for CC
        admin = await db.admin_users.find_one({}, {"_id": 0, "email": 1})
        admin_email = admin.get("email") if admin else SENDER_EMAIL
        
        # Send email with PDF attachment
        await send_contract_email(booking_dict, pdf_bytes, admin_email)
        logger.info(f"Contract PDF sent for booking {booking_dict['id']}")
    except Exception as e:
        logger.error(f"Failed to send contract PDF: {e}")

async def create_calendar_event_background(booking_dict: dict):
    """Background task to create calendar event"""
    try:
        event_uid = await create_calendar_event(booking_dict)
        if event_uid:
            await db.bookings.update_one(
                {"id": booking_dict["id"]},
                {"$set": {"calendar_event_id": event_uid}}
            )
            logger.info(f"Calendar event created for booking {booking_dict['id']}")
    except Exception as e:
        logger.error(f"Failed to create calendar event: {e}")

# ==================== PORTFOLIO (Public) ====================

@api_router.get("/portfolio")
async def get_portfolio(category: Optional[str] = None, featured_only: bool = False):
    """Get portfolio images, optionally filtered by category"""
    query = {}
    if category:
        query["category"] = category
    if featured_only:
        query["featured"] = True
    
    items = await db.portfolio.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    return items

# ==================== TESTIMONIALS (Public) ====================

@api_router.get("/testimonials")
async def get_testimonials():
    """Get approved testimonials"""
    items = await db.testimonials.find({"approved": True}, {"_id": 0}).to_list(50)
    return items

# ==================== CONTACT (Public) ====================

@api_router.post("/contact")
async def submit_contact(data: ContactMessageCreate):
    """Submit a contact message"""
    message = ContactMessage(**data.model_dump())
    doc = message.model_dump()
    await db.contact_messages.insert_one(doc)
    return message

# ==================== ADMIN AUTH ====================

@api_router.post("/admin/login")
async def admin_login(data: AdminLogin):
    """Admin login"""
    admin = await db.admins.find_one({"email": data.email}, {"_id": 0})
    if not admin or not verify_password(data.password, admin["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(data.email)
    return {"token": token, "name": admin["name"], "email": admin["email"]}

@api_router.post("/admin/setup")
async def setup_admin(data: AdminCreate):
    """Initial admin setup - only works if no admin exists"""
    existing = await db.admins.find_one()
    if existing:
        raise HTTPException(status_code=400, detail="Admin already exists")
    
    admin_doc = {
        "id": str(uuid.uuid4()),
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.admins.insert_one(admin_doc)
    return {"message": "Admin created successfully"}

@api_router.get("/admin/me")
async def get_current_admin(admin=Depends(verify_token)):
    """Get current admin info"""
    return {"name": admin["name"], "email": admin["email"]}

# ==================== ADMIN - PACKAGES ====================

@api_router.get("/admin/packages")
async def admin_get_packages(admin=Depends(verify_token)):
    """Get all packages (admin)"""
    packages = await db.packages.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    if not packages:
        # Seed with defaults
        defaults = get_default_packages()
        for pkg in defaults:
            pkg["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.packages.insert_one(pkg)
        packages = defaults
    return packages

@api_router.post("/admin/packages")
async def admin_create_package(data: PackageCreate, admin=Depends(verify_token)):
    """Create a new package"""
    # Get max order
    max_order_item = await db.packages.find_one(sort=[("order", -1)])
    max_order = max_order_item["order"] + 1 if max_order_item else 0
    
    package = Package(**data.model_dump(), order=max_order)
    doc = package.model_dump()
    await db.packages.insert_one(doc)
    return package

@api_router.put("/admin/packages/{package_id}")
async def admin_update_package(package_id: str, data: PackageCreate, admin=Depends(verify_token)):
    """Update a package"""
    update_data = data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.packages.update_one(
        {"id": package_id},
        {"$set": update_data}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    return {"message": "Package updated"}

@api_router.delete("/admin/packages/{package_id}")
async def admin_delete_package(package_id: str, admin=Depends(verify_token)):
    """Delete a package"""
    result = await db.packages.delete_one({"id": package_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    return {"message": "Package deleted"}

# ==================== ADMIN - BOOKING SETTINGS ====================

@api_router.get("/admin/booking-settings")
async def admin_get_booking_settings(admin=Depends(verify_token)):
    """Get booking settings"""
    settings = await db.booking_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        settings = BookingSettings().model_dump()
        await db.booking_settings.insert_one(settings)
    return settings

@api_router.put("/admin/booking-settings")
async def admin_update_booking_settings(data: BookingSettingsUpdate, admin=Depends(verify_token)):
    """Update booking settings"""
    update_data = data.model_dump()
    
    await db.booking_settings.update_one(
        {"id": "default"},
        {"$set": update_data},
        upsert=True
    )
    return {"message": "Settings updated"}

# ==================== ADMIN - BOOKINGS ====================

@api_router.get("/admin/bookings")
async def admin_get_bookings(
    admin=Depends(verify_token),
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Get all bookings with optional filters"""
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
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort("booking_date", -1).to_list(500)
    return bookings

@api_router.get("/admin/bookings/{booking_id}")
async def admin_get_booking(booking_id: str, admin=Depends(verify_token)):
    """Get a single booking"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking

@api_router.put("/admin/bookings/{booking_id}")
async def admin_update_booking(booking_id: str, data: BookingUpdate, admin=Depends(verify_token)):
    """Update a booking (full edit capabilities)"""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.bookings.update_one(
        {"id": booking_id},
        {"$set": update_data}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    return {"message": "Booking updated"}

@api_router.delete("/admin/bookings/{booking_id}")
async def admin_delete_booking(booking_id: str, admin=Depends(verify_token)):
    """Delete a booking"""
    result = await db.bookings.delete_one({"id": booking_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"message": "Booking deleted"}

# ==================== ADMIN - CALENDAR VIEW ====================

@api_router.get("/admin/calendar-view")
async def admin_get_calendar_view(start_date: str, end_date: str, admin=Depends(verify_token)):
    """
    Get calendar data for admin view including:
    - Bookings
    - Personal calendar events (from Apple Calendar)
    - Available time slots
    - Blocked slots
    """
    events = []
    
    # 1. Get booking settings for time slots
    booking_settings = await db.booking_settings.find_one({"id": "default"}, {"_id": 0})
    if not booking_settings:
        booking_settings = {"time_slots": ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"], "available_days": [1,2,3,4,5]}
    
    # Get all bookings in date range
    bookings = await db.bookings.find({
        "booking_date": {"$gte": start_date, "$lte": end_date},
        "status": {"$nin": ["cancelled"]}
    }, {"_id": 0}).to_list(500)
    
    # Track booked slots
    booked_slots = {}
    for booking in bookings:
        key = f"{booking['booking_date']}_{booking['booking_time']}"
        booked_slots[key] = booking
        
        # Parse time for proper event display
        hour, minute = parse_time_slot(booking["booking_time"])
        if hour is not None:
            start_dt = f"{booking['booking_date']}T{hour:02d}:{minute:02d}:00"
            end_hour = hour + 2  # Assume 2-hour sessions
            end_dt = f"{booking['booking_date']}T{end_hour:02d}:{minute:02d}:00"
        else:
            start_dt = f"{booking['booking_date']}T09:00:00"
            end_dt = f"{booking['booking_date']}T11:00:00"
        
        status_colors = {
            "pending": "#F59E0B",      # Amber
            "confirmed": "#10B981",    # Green
            "completed": "#6B7280",    # Gray
            "awaiting_client": "#8B5CF6"  # Purple
        }
        
        events.append({
            "id": f"booking-{booking['id']}",
            "title": f"📸 {booking['client_name']} - {booking['session_type'].title()}",
            "start": start_dt,
            "end": end_dt,
            "backgroundColor": status_colors.get(booking["status"], "#C6A87C"),
            "borderColor": status_colors.get(booking["status"], "#C6A87C"),
            "extendedProps": {
                "type": "booking",
                "bookingId": booking["id"],
                "status": booking["status"],
                "clientName": booking["client_name"],
                "clientEmail": booking["client_email"],
                "clientPhone": booking["client_phone"],
                "sessionType": booking["session_type"],
                "packageName": booking["package_name"],
                "totalPrice": booking.get("total_price", 0)
            }
        })
    
    # 2. Get blocked slots
    blocked_slots = await db.blocked_slots.find({
        "date": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(500)
    
    for slot in blocked_slots:
        hour, minute = parse_time_slot(slot["time"])
        if hour is not None:
            start_dt = f"{slot['date']}T{hour:02d}:{minute:02d}:00"
            end_hour = hour + 2
            end_dt = f"{slot['date']}T{end_hour:02d}:{minute:02d}:00"
        else:
            start_dt = f"{slot['date']}T09:00:00"
            end_dt = f"{slot['date']}T11:00:00"
        
        events.append({
            "id": f"blocked-{slot['id']}",
            "title": f"🚫 {slot.get('reason', 'Blocked')}",
            "start": start_dt,
            "end": end_dt,
            "backgroundColor": "#EF4444",
            "borderColor": "#EF4444",
            "extendedProps": {
                "type": "blocked",
                "slotId": slot["id"],
                "reason": slot.get("reason", "Blocked")
            }
        })
    
    # 3. Get Apple Calendar events from ALL calendars (personal + work)
    settings = await db.calendar_settings.find_one({"id": "default"})
    if settings and settings.get("sync_enabled"):
        try:
            start_dt_obj = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            end_dt_obj = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, tzinfo=timezone.utc)
            
            cal_events = await get_events_from_all_calendars(start_dt_obj, end_dt_obj)
            
            for cal_event in cal_events:
                events.append({
                    "id": f"personal-{uuid.uuid4()}",
                    "title": f"🔒 {cal_event['summary']} ({cal_event['calendar_name']})",
                    "start": cal_event["start"],
                    "end": cal_event["end"],
                    "backgroundColor": "#64748B",
                    "borderColor": "#64748B",
                    "extendedProps": {
                        "type": "personal",
                        "summary": cal_event["summary"],
                        "calendarName": cal_event["calendar_name"]
                    }
                })
        except Exception as e:
            logger.error(f"Failed to fetch calendar events: {e}")
    
    # 4. Generate OPEN time slots for each day in range
    # Get blocked slots as a set for quick lookup
    blocked_slots_db = await db.blocked_slots.find({
        "date": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(500)
    blocked_set = {f"{s['date']}_{s['time']}" for s in blocked_slots_db}
    
    # Get custom slots (manually added available slots)
    custom_slots_db = await db.custom_slots.find({
        "date": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(500)
    custom_slots_dict = {f"{s['date']}_{s['time']}": s for s in custom_slots_db}
    
    # Get calendar blocked times
    calendar_blocked = {}
    if settings and settings.get("sync_enabled"):
        try:
            start_dt_obj = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            end_dt_obj = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, tzinfo=timezone.utc)
            cal_events_raw = await get_events_from_all_calendars(start_dt_obj, end_dt_obj)
            
            for evt in cal_events_raw:
                try:
                    evt_start = datetime.fromisoformat(evt["start"].replace("Z", "+00:00"))
                    evt_end = datetime.fromisoformat(evt["end"].replace("Z", "+00:00"))
                    
                    # Handle multi-day events - block all dates the event spans
                    current_date = evt_start.date()
                    end_date_obj = evt_end.date()
                    
                    while current_date <= end_date_obj:
                        date_str = current_date.strftime("%Y-%m-%d")
                        if date_str not in calendar_blocked:
                            calendar_blocked[date_str] = []
                        
                        # For multi-day events, determine the blocking hours for this specific day
                        if current_date == evt_start.date() and current_date == evt_end.date():
                            # Single day event - use actual start/end times
                            block_start_hour = evt_start.hour
                            block_start_min = evt_start.minute
                            block_end_hour = evt_end.hour
                            block_end_min = evt_end.minute
                        elif current_date == evt_start.date():
                            # First day of multi-day event - block from start time to end of day
                            block_start_hour = evt_start.hour
                            block_start_min = evt_start.minute
                            block_end_hour = 23
                            block_end_min = 59
                        elif current_date == evt_end.date():
                            # Last day of multi-day event - block from start of day to end time
                            block_start_hour = 0
                            block_start_min = 0
                            block_end_hour = evt_end.hour
                            block_end_min = evt_end.minute
                        else:
                            # Middle day of multi-day event - block entire day
                            block_start_hour = 0
                            block_start_min = 0
                            block_end_hour = 23
                            block_end_min = 59
                        
                        calendar_blocked[date_str].append({
                            "start_hour": block_start_hour,
                            "start_min": block_start_min,
                            "end_hour": block_end_hour,
                            "end_min": block_end_min
                        })
                        
                        current_date += timedelta(days=1)
                except:
                    pass
        except:
            pass
    
    # Get time slot schedule from settings
    time_slot_schedule = booking_settings.get("time_slot_schedule", {})
    
    # First, add custom slots (these override normal schedule)
    for slot_key, slot_data in custom_slots_dict.items():
        date_str = slot_data["date"]
        time_slot = slot_data["time"]
        
        # Skip if booked or blocked
        if slot_key in booked_slots or slot_key in blocked_set:
            continue
        
        hour, minute = parse_time_slot(time_slot)
        if hour is None:
            continue
        
        # Check calendar blocking
        is_calendar_blocked = False
        if date_str in calendar_blocked:
            slot_start = hour * 60 + minute
            slot_end = (hour + 2) * 60 + minute
            for cal_evt in calendar_blocked[date_str]:
                evt_start = cal_evt["start_hour"] * 60 + cal_evt["start_min"]
                evt_end = cal_evt["end_hour"] * 60 + cal_evt["end_min"]
                if not (slot_end <= evt_start or slot_start >= evt_end):
                    is_calendar_blocked = True
                    break
        
        if is_calendar_blocked:
            continue
        
        start_dt = f"{date_str}T{hour:02d}:{minute:02d}:00"
        end_hour = hour + 2
        end_dt = f"{date_str}T{end_hour:02d}:{minute:02d}:00"
        
        events.append({
            "id": f"open-{date_str}-{time_slot}",
            "title": "✅ Available",
            "start": start_dt,
            "end": end_dt,
            "backgroundColor": "#22C55E",
            "borderColor": "#22C55E",
            "display": "block",
            "extendedProps": {
                "type": "open",
                "date": date_str,
                "time": time_slot,
                "isCustom": True
            }
        })
    
    # Generate dates in range for regular schedule
    # Derive available days and time slots from time_slot_schedule
    # A day is available if ANY session type has time slots configured for it
    all_available_slots_by_day = {}  # day_id -> set of time slots (aggregated across all session types)
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
        day_of_week = current.weekday()  # 0=Mon, 6=Sun
        # Convert to our format (0=Sun, 1=Mon, etc.)
        day_id = (day_of_week + 1) % 7
        
        # Get time slots for this day (if any)
        day_time_slots = all_available_slots_by_day.get(day_id, set())
        
        for time_slot in sorted(day_time_slots):
            slot_key = f"{date_str}_{time_slot}"
            
            # Skip if already booked, blocked, or already added as custom slot
            if slot_key in booked_slots or slot_key in blocked_set or slot_key in custom_slots_dict:
                continue
            
            # Check if blocked by calendar event
            hour, minute = parse_time_slot(time_slot)
            if hour is None:
                continue
            
            is_calendar_blocked = False
            if date_str in calendar_blocked:
                slot_start = hour * 60 + minute
                slot_end = (hour + 2) * 60 + minute  # 2-hour session
                
                for cal_evt in calendar_blocked[date_str]:
                    evt_start = cal_evt["start_hour"] * 60 + cal_evt["start_min"]
                    evt_end = cal_evt["end_hour"] * 60 + cal_evt["end_min"]
                    
                    # Check overlap
                    if not (slot_end <= evt_start or slot_start >= evt_end):
                        is_calendar_blocked = True
                        break
            
            if is_calendar_blocked:
                continue
            
            # Add as open slot
            start_dt = f"{date_str}T{hour:02d}:{minute:02d}:00"
            end_hour = hour + 2
            end_dt = f"{date_str}T{end_hour:02d}:{minute:02d}:00"
            
            events.append({
                "id": f"open-{date_str}-{time_slot}",
                "title": "✅ Available",
                "start": start_dt,
                "end": end_dt,
                "backgroundColor": "#22C55E",  # Green
                "borderColor": "#22C55E",
                "display": "block",
                "extendedProps": {
                    "type": "open",
                    "date": date_str,
                    "time": time_slot
                }
            })
        
        current += timedelta(days=1)
    
    return {"events": events}

@api_router.post("/admin/blocked-slots")
async def admin_create_blocked_slot(data: dict, admin=Depends(verify_token)):
    """Block a time slot"""
    slot = BlockedSlot(
        date=data["date"],
        time=data["time"],
        reason=data.get("reason", "Blocked by admin")
    )
    await db.blocked_slots.insert_one(slot.model_dump())
    return {"message": "Slot blocked", "id": slot.id}

@api_router.delete("/admin/blocked-slots/{slot_id}")
async def admin_delete_blocked_slot(slot_id: str, admin=Depends(verify_token)):
    """Unblock a time slot"""
    result = await db.blocked_slots.delete_one({"id": slot_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blocked slot not found")
    return {"message": "Slot unblocked"}

@api_router.post("/admin/custom-slots")
async def admin_create_custom_slot(data: dict, admin=Depends(verify_token)):
    """Add a custom available time slot for a specific date"""
    slot = CustomSlot(
        date=data["date"],
        time=data["time"]
    )
    # Check if slot already exists
    existing = await db.custom_slots.find_one({"date": data["date"], "time": data["time"]})
    if existing:
        raise HTTPException(status_code=400, detail="This time slot already exists")
    
    await db.custom_slots.insert_one(slot.model_dump())
    return {"message": "Time slot added", "id": slot.id}

@api_router.delete("/admin/custom-slots/{slot_id}")
async def admin_delete_custom_slot(slot_id: str, admin=Depends(verify_token)):
    """Remove a custom time slot"""
    result = await db.custom_slots.delete_one({"id": slot_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom slot not found")
    return {"message": "Time slot removed"}

# ==================== MANUAL BOOKING FLOW ====================

@api_router.post("/admin/manual-booking")
async def admin_create_manual_booking(data: ManualBookingCreate, background_tasks: BackgroundTasks, admin=Depends(verify_token)):
    """
    Create a manual booking placeholder and send link to client.
    The booking starts as 'awaiting_client' status.
    """
    # Create the booking with placeholder data
    booking = Booking(
        client_name=data.client_name,
        client_email=data.client_email,
        client_phone=data.client_phone,
        session_type=data.session_type,
        package_id="pending",
        package_name="To be selected",
        package_price=0,
        booking_date=data.booking_date,
        booking_time=data.booking_time,
        notes=data.notes,
        status="awaiting_client"
    )
    
    await db.bookings.insert_one(booking.model_dump())
    
    # Create a unique token for the client to complete the booking
    token = ManualBookingToken(
        booking_id=booking.id,
        expires_at=(datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    )
    await db.booking_tokens.insert_one(token.model_dump())
    
    # Send email with booking link
    background_tasks.add_task(send_manual_booking_email, booking.model_dump(), token.token)
    
    return {
        "message": "Manual booking created",
        "booking_id": booking.id,
        "token": token.token,
        "booking_link": f"/complete-booking/{token.token}"
    }

async def send_manual_booking_email(booking: dict, token: str):
    """Send email to client with link to complete their booking"""
    if not SENDGRID_API_KEY:
        logger.warning("SendGrid not configured, skipping manual booking email")
        return
    
    booking_link = f"https://silwerlining.co.za/complete-booking/{token}"  # Update with actual domain
    
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
        
        <p>Please click the button below to complete your booking by selecting your package and providing additional details:</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{booking_link}" style="background-color: #C6A87C; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">
                Complete Your Booking
            </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">This link will expire in 7 days. If you have any questions, please don't hesitate to contact us.</p>
        
        <p>With love,<br>Silwer Lining Photography</p>
    </div>
    """
    
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        message = Mail(
            from_email=SENDGRID_FROM_EMAIL,
            to_emails=booking['client_email'],
            subject="Complete Your Photography Session Booking - Silwer Lining",
            html_content=html_content
        )
        sg.send(message)
        logger.info(f"Manual booking email sent to {booking['client_email']}")
    except Exception as e:
        logger.error(f"Failed to send manual booking email: {e}")

@api_router.get("/booking-token/{token}")
async def get_booking_by_token(token: str):
    """Get booking details by token (public endpoint for client to complete booking)"""
    token_doc = await db.booking_tokens.find_one({"token": token}, {"_id": 0})
    
    if not token_doc:
        raise HTTPException(status_code=404, detail="Invalid or expired booking link")
    
    if token_doc.get("used"):
        raise HTTPException(status_code=400, detail="This booking link has already been used")
    
    # Check expiration
    expires_at = datetime.fromisoformat(token_doc["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="This booking link has expired")
    
    # Get the booking
    booking = await db.bookings.find_one({"id": token_doc["booking_id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get available packages for this session type
    packages = await db.packages.find(
        {"session_type": booking["session_type"], "active": True},
        {"_id": 0}
    ).sort("order", 1).to_list(20)
    
    # Get available add-ons
    addons = await db.addons.find(
        {"active": True, "$or": [
            {"categories": {"$in": [booking["session_type"]]}},
            {"categories": {"$size": 0}}
        ]},
        {"_id": 0}
    ).to_list(50)
    
    # Get questionnaire if exists
    questionnaire = await db.questionnaires.find_one(
        {"session_type": booking["session_type"], "active": True},
        {"_id": 0}
    )
    
    return {
        "booking": booking,
        "packages": packages,
        "addons": addons,
        "questionnaire": questionnaire
    }

@api_router.post("/booking-token/{token}/complete")
async def complete_booking_by_token(token: str, data: dict, background_tasks: BackgroundTasks):
    """Complete a booking using the token (client selects package, answers questionnaire)"""
    token_doc = await db.booking_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=404, detail="Invalid booking link")
    
    if token_doc.get("used"):
        raise HTTPException(status_code=400, detail="This booking link has already been used")
    
    # Check expiration
    expires_at = datetime.fromisoformat(token_doc["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="This booking link has expired")
    
    # Update the booking with client's selections
    update_data = {
        "package_id": data.get("package_id", ""),
        "package_name": data.get("package_name", ""),
        "package_price": data.get("package_price", 0),
        "selected_addons": data.get("selected_addons", []),
        "addons_total": data.get("addons_total", 0),
        "total_price": data.get("total_price", 0),
        "questionnaire_responses": data.get("questionnaire_responses", {}),
        "client_phone": data.get("client_phone", ""),
        "notes": data.get("notes", ""),
        "status": "confirmed",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bookings.update_one(
        {"id": token_doc["booking_id"]},
        {"$set": update_data}
    )
    
    # Mark token as used
    await db.booking_tokens.update_one(
        {"token": token},
        {"$set": {"used": True}}
    )
    
    # Get updated booking and send confirmation
    booking = await db.bookings.find_one({"id": token_doc["booking_id"]}, {"_id": 0})
    
    # Send confirmation email
    background_tasks.add_task(send_booking_confirmation_email, booking)
    
    # Create calendar event
    background_tasks.add_task(create_calendar_event_background, booking)
    
    return {"message": "Booking completed successfully", "booking": booking}

# ==================== ADMIN - CALENDAR SYNC ====================

async def get_caldav_client():
    """Get CalDAV client with stored credentials"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("apple_calendar_password"):
        return None, None
    
    url = settings.get("apple_calendar_url") or "https://caldav.icloud.com"
    username = settings.get("apple_calendar_user")
    password = settings.get("apple_calendar_password")
    
    if not username or not password:
        return None, None
    
    try:
        client = caldav.DAVClient(url=url, username=username, password=password)
        principal = client.principal()
        calendars = principal.calendars()
        
        # Get the calendar for bookings (from settings, or first one)
        booking_calendar_name = settings.get("booking_calendar", "")
        target_calendar = None
        
        for cal in calendars:
            cal_name = cal.name.lower() if cal.name else ""
            # Use the configured booking calendar if set
            if booking_calendar_name and cal.name == booking_calendar_name:
                target_calendar = cal
                break
            # Otherwise look for photography/booking related calendar
            if "silwer" in cal_name or "photography" in cal_name or "booking" in cal_name or "work" in cal_name:
                target_calendar = cal
                break
        
        if not target_calendar and calendars:
            target_calendar = calendars[0]
        
        return client, target_calendar
    except Exception as e:
        logger.error(f"CalDAV connection error: {e}")
        return None, None

async def get_all_caldav_calendars():
    """Get all CalDAV calendars for the user"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("apple_calendar_password"):
        return []
    
    url = settings.get("apple_calendar_url") or "https://caldav.icloud.com"
    username = settings.get("apple_calendar_user")
    password = settings.get("apple_calendar_password")
    
    if not username or not password:
        return []
    
    try:
        client = caldav.DAVClient(url=url, username=username, password=password)
        principal = client.principal()
        calendars = principal.calendars()
        return [{"name": cal.name, "id": str(cal.id)} for cal in calendars]
    except Exception as e:
        logger.error(f"Failed to get calendars: {e}")
        return []

async def get_events_from_all_calendars(start_date: datetime, end_date: datetime) -> List[dict]:
    """Fetch events from ALL calendars (personal + work)"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("apple_calendar_password"):
        return []
    
    url = settings.get("apple_calendar_url") or "https://caldav.icloud.com"
    username = settings.get("apple_calendar_user")
    password = settings.get("apple_calendar_password")
    booking_calendar = settings.get("booking_calendar", "")
    
    if not username or not password:
        return []
    
    all_events = []
    
    try:
        client = caldav.DAVClient(url=url, username=username, password=password)
        principal = client.principal()
        calendars = principal.calendars()
        
        for calendar in calendars:
            try:
                cal_events = calendar.search(start=start_date, end=end_date, expand=True)
                
                for event in cal_events:
                    ical = event.icalendar_component
                    for component in ical.walk():
                        if component.name == "VEVENT":
                            summary = str(component.get('summary', 'Personal Event'))
                            
                            # Skip our own booking events
                            if '📸' in summary or 'silwerlining' in summary.lower():
                                continue
                            
                            dtstart = component.get('dtstart')
                            dtend = component.get('dtend')
                            
                            if dtstart:
                                if hasattr(dtstart.dt, 'isoformat'):
                                    start_str = dtstart.dt.isoformat()
                                else:
                                    start_str = f"{dtstart.dt}T00:00:00"
                                
                                if dtend:
                                    if hasattr(dtend.dt, 'isoformat'):
                                        end_str = dtend.dt.isoformat()
                                    else:
                                        end_str = f"{dtend.dt}T23:59:59"
                                else:
                                    end_str = start_str
                                
                                all_events.append({
                                    "summary": summary,
                                    "start": start_str,
                                    "end": end_str,
                                    "calendar_name": calendar.name,
                                    "is_work_calendar": calendar.name == booking_calendar
                                })
            except Exception as e:
                logger.error(f"Failed to fetch events from calendar {calendar.name}: {e}")
                continue
        
        return all_events
    except Exception as e:
        logger.error(f"Failed to connect to CalDAV: {e}")
        return []

async def get_booking_calendar():
    """Get the calendar designated for creating bookings"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("apple_calendar_password"):
        return None
    
    url = settings.get("apple_calendar_url") or "https://caldav.icloud.com"
    username = settings.get("apple_calendar_user")
    password = settings.get("apple_calendar_password")
    booking_calendar_name = settings.get("booking_calendar", "")
    
    if not username or not password:
        return None
    
    try:
        client = caldav.DAVClient(url=url, username=username, password=password)
        principal = client.principal()
        calendars = principal.calendars()
        
        # Find the designated booking calendar
        for cal in calendars:
            if booking_calendar_name and cal.name == booking_calendar_name:
                return cal
        
        # Fallback to first calendar
        return calendars[0] if calendars else None
    except Exception as e:
        logger.error(f"Failed to get booking calendar: {e}")
        return None

async def create_calendar_event(booking: dict) -> Optional[str]:
    """Create a calendar event for a booking on the designated booking calendar"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("sync_enabled"):
        return None
    
    # Use the designated booking calendar
    calendar = await get_booking_calendar()
    if not calendar:
        logger.warning("No calendar available for sync")
        return None
    
    try:
        # Parse booking date and time
        booking_date = datetime.strptime(booking["booking_date"], "%Y-%m-%d")
        time_parts = booking["booking_time"].replace("AM", "").replace("PM", "").strip().split(":")
        hour = int(time_parts[0])
        minute = int(time_parts[1]) if len(time_parts) > 1 else 0
        
        # Handle AM/PM
        if "PM" in booking["booking_time"] and hour != 12:
            hour += 12
        elif "AM" in booking["booking_time"] and hour == 12:
            hour = 0
        
        start_dt = booking_date.replace(hour=hour, minute=minute, tzinfo=timezone.utc)
        end_dt = start_dt + timedelta(hours=2)  # Assume 2-hour session
        
        # Create iCalendar event
        cal = ICalendar()
        cal.add('prodid', '-//Silwer Lining Photography//Booking System//EN')
        cal.add('version', '2.0')
        
        event = ICalEvent()
        event_uid = f"booking-{booking['id']}@silwerlining.co.za"
        event.add('uid', event_uid)
        event.add('dtstart', start_dt)
        event.add('dtend', end_dt)
        event.add('summary', f"📸 {booking['session_type'].title()} Session - {booking['client_name']}")
        event.add('description', f"""
Client: {booking['client_name']}
Email: {booking['client_email']}
Phone: {booking['client_phone']}
Package: {booking['package_name']}
Total: R{booking.get('total_price', 0):,.0f}
Notes: {booking.get('notes', 'None')}
        """.strip())
        event.add('location', 'Silwer Lining Photography Studio, Helderkruin, Roodepoort')
        
        cal.add_component(event)
        
        # Save to CalDAV - use the booking calendar
        calendar.save_event(cal.to_ical().decode('utf-8'))
        logger.info(f"Calendar event created for booking {booking['id']} on calendar: {calendar.name}")
        return event_uid
        
    except Exception as e:
        logger.error(f"Failed to create calendar event: {e}")
        return None

async def delete_calendar_event(event_uid: str):
    """Delete a calendar event"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("sync_enabled"):
        return False
    
    _, calendar = await get_caldav_client()
    if not calendar:
        return False
    
    try:
        # Search for the event by UID
        events = calendar.search(uid=event_uid)
        for event in events:
            event.delete()
            logger.info(f"Calendar event deleted: {event_uid}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete calendar event: {e}")
        return False

async def get_blocked_times_from_calendar(date_str: str) -> List[dict]:
    """Get blocked times from calendar for a specific date"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("sync_enabled"):
        return []
    
    _, calendar = await get_caldav_client()
    if not calendar:
        return []
    
    try:
        date = datetime.strptime(date_str, "%Y-%m-%d")
        start = date.replace(hour=0, minute=0, second=0, tzinfo=timezone.utc)
        end = date.replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        
        events = calendar.search(start=start, end=end, expand=True)
        blocked = []
        
        for event in events:
            ical = event.icalendar_component
            for component in ical.walk():
                if component.name == "VEVENT":
                    dtstart = component.get('dtstart')
                    dtend = component.get('dtend')
                    if dtstart and dtend:
                        blocked.append({
                            "start": dtstart.dt.isoformat() if hasattr(dtstart.dt, 'isoformat') else str(dtstart.dt),
                            "end": dtend.dt.isoformat() if hasattr(dtend.dt, 'isoformat') else str(dtend.dt),
                            "summary": str(component.get('summary', 'Busy'))
                        })
        
        return blocked
    except Exception as e:
        logger.error(f"Failed to get calendar events: {e}")
        return []

async def get_calendar_blocked_times(date_str: str, time_slots: List[str]) -> List[str]:
    """Check which time slots are blocked by calendar events from ALL calendars"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("sync_enabled"):
        return []
    
    blocked_slots = []
    
    try:
        date = datetime.strptime(date_str, "%Y-%m-%d")
        requested_date = date.date()
        
        # Get events from ALL calendars using the same function as calendar view
        start_of_day = date.replace(hour=0, minute=0, second=0, tzinfo=timezone.utc)
        end_of_day = date.replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        
        cal_events_raw = await get_events_from_all_calendars(start_of_day, end_of_day)
        
        calendar_events = []
        for evt in cal_events_raw:
            summary = evt.get("summary", "")
            
            # Skip events that are bookings we created (they have 📸 in title)
            if '📸' in summary or 'silwerlining' in summary.lower():
                continue
            
            try:
                evt_start = datetime.fromisoformat(evt["start"].replace("Z", "+00:00"))
                evt_end = datetime.fromisoformat(evt["end"].replace("Z", "+00:00"))
                
                # Handle all-day events (no time component)
                if not hasattr(evt_start, 'hour') or evt_start.hour == 0 and evt_start.minute == 0 and evt_end.hour == 0 and evt_end.minute == 0:
                    # Could be all-day event
                    event_start_date = evt_start.date() if hasattr(evt_start, 'date') else evt_start
                    event_end_date = evt_end.date() if hasattr(evt_end, 'date') else evt_end
                    
                    # If event spans multiple days and covers requested date entirely
                    if event_start_date <= requested_date < event_end_date:
                        return time_slots  # All slots blocked
                
                # For multi-day events, determine blocking hours for THIS specific date
                event_start_date = evt_start.date()
                event_end_date = evt_end.date()
                
                # Calculate effective blocking hours for this day
                if event_start_date == event_end_date == requested_date:
                    # Single day event - use actual times
                    block_start_hour = evt_start.hour
                    block_start_min = evt_start.minute
                    block_end_hour = evt_end.hour
                    block_end_min = evt_end.minute
                elif event_start_date == requested_date:
                    # First day of multi-day event
                    block_start_hour = evt_start.hour
                    block_start_min = evt_start.minute
                    block_end_hour = 23
                    block_end_min = 59
                elif event_end_date == requested_date:
                    # Last day of multi-day event
                    block_start_hour = 0
                    block_start_min = 0
                    block_end_hour = evt_end.hour
                    block_end_min = evt_end.minute
                elif event_start_date < requested_date < event_end_date:
                    # Middle day of multi-day event - block entire day
                    return time_slots  # All slots blocked
                else:
                    continue  # Event doesn't affect this date
                
                calendar_events.append({
                    "start_hour": block_start_hour,
                    "start_minute": block_start_min,
                    "end_hour": block_end_hour,
                    "end_minute": block_end_min
                })
            except Exception as e:
                logger.error(f"Error processing calendar event: {e}")
                continue
        
        # Check each time slot against calendar events
        for time_slot in time_slots:
            # Parse time slot (formats: "09:00", "9:00 AM", "14:00", "2:00 PM")
            slot_hour, slot_minute = parse_time_slot(time_slot)
            if slot_hour is None:
                continue
            
            # Check if this slot overlaps with any calendar event
            # Assume 2-hour session duration
            slot_end_hour = slot_hour + 2
            
            for evt in calendar_events:
                evt_start = evt["start_hour"] * 60 + evt["start_minute"]
                evt_end = evt["end_hour"] * 60 + evt["end_minute"]
                slot_start = slot_hour * 60 + slot_minute
                slot_end = slot_end_hour * 60 + slot_minute
                
                # Check for overlap
                if not (slot_end <= evt_start or slot_start >= evt_end):
                    blocked_slots.append(time_slot)
                    break
        
        return blocked_slots
        
    except Exception as e:
        logger.error(f"Failed to check calendar blocked times: {e}")
        return []

def parse_time_slot(time_str: str) -> tuple:
    """Parse a time slot string into hour and minute"""
    try:
        time_str = time_str.strip().upper()
        
        # Handle AM/PM format
        is_pm = "PM" in time_str
        is_am = "AM" in time_str
        time_str = time_str.replace("AM", "").replace("PM", "").strip()
        
        parts = time_str.split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        
        if is_pm and hour != 12:
            hour += 12
        elif is_am and hour == 12:
            hour = 0
        
        return hour, minute
    except:
        return None, None

@api_router.get("/admin/calendar-settings")
async def admin_get_calendar_settings(admin=Depends(verify_token)):
    """Get calendar sync settings"""
    settings = await db.calendar_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        settings = {
            "id": "default",
            "apple_calendar_url": "",
            "apple_calendar_user": "",
            "sync_enabled": False,
            "booking_calendar": ""
        }
    # Don't return the password
    settings.pop("apple_calendar_password", None)
    return settings

@api_router.get("/admin/calendars")
async def admin_list_calendars(admin=Depends(verify_token)):
    """List all available Apple Calendars"""
    calendars = await get_all_caldav_calendars()
    return {"calendars": calendars}

@api_router.put("/admin/calendar-settings")
async def admin_update_calendar_settings(data: dict, admin=Depends(verify_token)):
    """Update calendar sync settings"""
    update_data = {
        "id": "default",
        "apple_calendar_url": data.get("apple_calendar_url", ""),
        "apple_calendar_user": data.get("apple_calendar_user", ""),
        "sync_enabled": data.get("sync_enabled", False),
        "booking_calendar": data.get("booking_calendar", "")
    }
    
    # Only update password if provided
    if data.get("apple_calendar_password"):
        update_data["apple_calendar_password"] = data.get("apple_calendar_password")
    
    await db.calendar_settings.update_one(
        {"id": "default"},
        {"$set": update_data},
        upsert=True
    )
    return {"message": "Calendar settings updated"}

@api_router.post("/admin/calendar/sync")
async def admin_sync_calendar(admin=Depends(verify_token)):
    """Manually trigger calendar sync - syncs all confirmed bookings"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings or not settings.get("sync_enabled"):
        raise HTTPException(status_code=400, detail="Calendar sync not enabled")
    
    if not settings.get("apple_calendar_password"):
        raise HTTPException(status_code=400, detail="Apple Calendar credentials not configured")
    
    # Test connection
    client, calendar = await get_caldav_client()
    if not calendar:
        raise HTTPException(status_code=400, detail="Failed to connect to Apple Calendar. Check your credentials.")
    
    # Sync all confirmed bookings that don't have calendar events
    bookings = await db.bookings.find({
        "status": "confirmed",
        "calendar_event_id": {"$exists": False}
    }).to_list(100)
    
    synced = 0
    errors = 0
    
    for booking in bookings:
        booking_dict = {**booking, "id": booking.get("id")}
        event_uid = await create_calendar_event(booking_dict)
        if event_uid:
            await db.bookings.update_one(
                {"id": booking["id"]},
                {"$set": {"calendar_event_id": event_uid}}
            )
            synced += 1
        else:
            errors += 1
    
    return {
        "message": f"Calendar sync completed",
        "synced": synced,
        "errors": errors,
        "calendar_name": calendar.name if calendar else "Unknown"
    }

@api_router.post("/admin/calendar/test")
async def admin_test_calendar_connection(admin=Depends(verify_token)):
    """Test Apple Calendar connection"""
    settings = await db.calendar_settings.find_one({"id": "default"})
    if not settings:
        raise HTTPException(status_code=400, detail="Calendar settings not configured")
    
    if not settings.get("apple_calendar_password"):
        raise HTTPException(status_code=400, detail="Apple Calendar password not set")
    
    client, calendar = await get_caldav_client()
    if not calendar:
        raise HTTPException(status_code=400, detail="Failed to connect to Apple Calendar. Check your credentials.")
    
    return {
        "status": "connected",
        "calendar_name": calendar.name,
        "message": f"Successfully connected to calendar: {calendar.name}"
    }

@api_router.get("/admin/calendar/events")
async def admin_get_calendar_events(date: str, admin=Depends(verify_token)):
    """Get calendar events for a specific date (for debugging 2-way sync)"""
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
                    dtstart = component.get('dtstart')
                    dtend = component.get('dtend')
                    summary = str(component.get('summary', 'No Title'))
                    
                    start_str = dtstart.dt.isoformat() if dtstart and hasattr(dtstart.dt, 'isoformat') else str(dtstart.dt) if dtstart else "Unknown"
                    end_str = dtend.dt.isoformat() if dtend and hasattr(dtend.dt, 'isoformat') else str(dtend.dt) if dtend else "Unknown"
                    
                    is_booking = '📸' in summary or 'silwerlining' in summary.lower()
                    
                    event_list.append({
                        "summary": summary,
                        "start": start_str,
                        "end": end_str,
                        "is_booking_event": is_booking,
                        "blocks_availability": not is_booking
                    })
        
        return {
            "date": date,
            "calendar_name": calendar.name,
            "event_count": len(event_list),
            "events": event_list
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        logger.error(f"Failed to get calendar events: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching events: {str(e)}")

# ==================== ADMIN - PORTFOLIO ====================

@api_router.get("/admin/portfolio")
async def admin_get_portfolio(admin=Depends(verify_token)):
    """Get all portfolio items"""
    items = await db.portfolio.find({}, {"_id": 0}).sort("order", 1).to_list(200)
    return items

@api_router.post("/admin/portfolio")
async def admin_create_portfolio(data: PortfolioCreate, admin=Depends(verify_token)):
    """Create a portfolio item"""
    max_order_item = await db.portfolio.find_one(sort=[("order", -1)])
    max_order = max_order_item["order"] + 1 if max_order_item else 0
    
    item = Portfolio(**data.model_dump(), order=max_order)
    doc = item.model_dump()
    await db.portfolio.insert_one(doc)
    return item

@api_router.put("/admin/portfolio/{item_id}")
async def admin_update_portfolio(item_id: str, data: PortfolioCreate, admin=Depends(verify_token)):
    """Update a portfolio item"""
    result = await db.portfolio.update_one(
        {"id": item_id},
        {"$set": data.model_dump()}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Portfolio item updated"}

@api_router.delete("/admin/portfolio/{item_id}")
async def admin_delete_portfolio(item_id: str, admin=Depends(verify_token)):
    """Delete a portfolio item"""
    result = await db.portfolio.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Portfolio item deleted"}

# ==================== ADMIN - TESTIMONIALS ====================

@api_router.get("/admin/testimonials")
async def admin_get_testimonials(admin=Depends(verify_token)):
    """Get all testimonials"""
    items = await db.testimonials.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

@api_router.post("/admin/testimonials")
async def admin_create_testimonial(data: TestimonialCreate, admin=Depends(verify_token)):
    """Create a testimonial"""
    item = Testimonial(**data.model_dump(), approved=True)
    doc = item.model_dump()
    await db.testimonials.insert_one(doc)
    return item

@api_router.put("/admin/testimonials/{item_id}")
async def admin_update_testimonial(item_id: str, approved: bool, admin=Depends(verify_token)):
    """Update testimonial approval status"""
    result = await db.testimonials.update_one(
        {"id": item_id},
        {"$set": {"approved": approved}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    return {"message": "Testimonial updated"}

@api_router.delete("/admin/testimonials/{item_id}")
async def admin_delete_testimonial(item_id: str, admin=Depends(verify_token)):
    """Delete a testimonial"""
    result = await db.testimonials.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    return {"message": "Testimonial deleted"}

# ==================== GOOGLE REVIEWS ====================

@api_router.get("/admin/google-reviews/settings")
async def get_google_reviews_settings(admin=Depends(verify_token)):
    """Get Google Reviews settings"""
    settings = await db.google_reviews_settings.find_one({"id": "default"}, {"_id": 0})
    return settings or {}

@api_router.put("/admin/google-reviews/settings")
async def save_google_reviews_settings(data: dict, admin=Depends(verify_token)):
    """Save Google Reviews settings"""
    await db.google_reviews_settings.update_one(
        {"id": "default"},
        {"$set": {
            "id": "default",
            "enabled": data.get("enabled", False),
            "api_key": data.get("api_key", ""),
            "place_id": data.get("place_id", ""),
            "auto_fetch": data.get("auto_fetch", False),
            "fetch_frequency": data.get("fetch_frequency", "daily"),
            "last_fetched": data.get("last_fetched"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"message": "Settings saved"}

@api_router.post("/admin/google-reviews/fetch")
async def fetch_google_reviews(admin=Depends(verify_token)):
    """Fetch reviews from Google Places API"""
    import httpx
    
    settings = await db.google_reviews_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings or not settings.get("enabled"):
        raise HTTPException(status_code=400, detail="Google Reviews not enabled")
    
    api_key = settings.get("api_key")
    place_id = settings.get("place_id")
    
    if not api_key or not place_id:
        raise HTTPException(status_code=400, detail="API key and Place ID required")
    
    try:
        # Fetch place details including reviews
        url = f"https://maps.googleapis.com/maps/api/place/details/json"
        params = {
            "place_id": place_id,
            "fields": "reviews,rating,user_ratings_total",
            "key": api_key
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            data = response.json()
        
        if data.get("status") != "OK":
            error_msg = data.get("error_message", data.get("status", "Unknown error"))
            raise HTTPException(status_code=400, detail=f"Google API error: {error_msg}")
        
        reviews = data.get("result", {}).get("reviews", [])[:5]  # Get only 5 most recent
        
        # Store reviews as testimonials
        count = 0
        for review in reviews:
            review_id = f"google_{review.get('time', '')}"
            
            # Check if already exists
            existing = await db.testimonials.find_one({"id": review_id})
            if existing:
                continue
            
            await db.testimonials.insert_one({
                "id": review_id,
                "source": "google",
                "client_name": review.get("author_name", "Google User"),
                "author_name": review.get("author_name", ""),
                "profile_photo_url": review.get("profile_photo_url", ""),
                "rating": review.get("rating", 5),
                "content": review.get("text", ""),
                "text": review.get("text", ""),
                "relative_time_description": review.get("relative_time_description", ""),
                "time": review.get("time", 0),
                "session_type": "google",
                "approved": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            count += 1
        
        # Update last fetched time
        await db.google_reviews_settings.update_one(
            {"id": "default"},
            {"$set": {"last_fetched": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"count": count, "message": f"Fetched {count} new reviews"}
        
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to Google: {str(e)}")

@api_router.get("/google-reviews/public")
async def get_public_google_reviews():
    """Get Google reviews for public display"""
    settings = await db.google_reviews_settings.find_one({"id": "default"}, {"_id": 0})
    
    # Get approved Google reviews
    reviews = await db.testimonials.find(
        {"source": "google", "approved": True},
        {"_id": 0}
    ).sort("time", -1).limit(5).to_list(5)
    
    place_id = settings.get("place_id", "") if settings else ""
    
    return {
        "reviews": reviews,
        "place_id": place_id,
        "google_url": f"https://search.google.com/local/reviews?placeid={place_id}" if place_id else ""
    }

@api_router.post("/cron/fetch-google-reviews")
async def cron_fetch_google_reviews():
    """Cron endpoint to auto-fetch Google reviews"""
    settings = await db.google_reviews_settings.find_one({"id": "default"}, {"_id": 0})
    
    if not settings or not settings.get("enabled") or not settings.get("auto_fetch"):
        return {"message": "Auto-fetch not enabled"}
    
    # Check frequency
    last_fetched = settings.get("last_fetched")
    frequency = settings.get("fetch_frequency", "daily")
    
    if last_fetched:
        from datetime import timedelta
        last_dt = datetime.fromisoformat(last_fetched.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        
        if frequency == "daily" and (now - last_dt) < timedelta(days=1):
            return {"message": "Already fetched today"}
        elif frequency == "weekly" and (now - last_dt) < timedelta(weeks=1):
            return {"message": "Already fetched this week"}
        elif frequency == "monthly" and (now - last_dt) < timedelta(days=30):
            return {"message": "Already fetched this month"}
    
    # Fetch using existing logic (without auth)
    import httpx
    
    api_key = settings.get("api_key")
    place_id = settings.get("place_id")
    
    if not api_key or not place_id:
        return {"message": "Missing API credentials"}
    
    try:
        url = f"https://maps.googleapis.com/maps/api/place/details/json"
        params = {
            "place_id": place_id,
            "fields": "reviews",
            "key": api_key
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
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
                "id": review_id,
                "source": "google",
                "client_name": review.get("author_name", "Google User"),
                "author_name": review.get("author_name", ""),
                "profile_photo_url": review.get("profile_photo_url", ""),
                "rating": review.get("rating", 5),
                "content": review.get("text", ""),
                "text": review.get("text", ""),
                "relative_time_description": review.get("relative_time_description", ""),
                "time": review.get("time", 0),
                "session_type": "google",
                "approved": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            count += 1
        
        await db.google_reviews_settings.update_one(
            {"id": "default"},
            {"$set": {"last_fetched": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"message": f"Fetched {count} new reviews", "count": count}
        
    except Exception as e:
        return {"message": f"Error: {str(e)}"}

# ==================== ADMIN - MESSAGES ====================

@api_router.get("/admin/messages")
async def admin_get_messages(admin=Depends(verify_token)):
    """Get all contact messages"""
    messages = await db.contact_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return messages

@api_router.put("/admin/messages/{message_id}")
async def admin_mark_read(message_id: str, admin=Depends(verify_token)):
    """Mark message as read"""
    result = await db.contact_messages.update_one(
        {"id": message_id},
        {"$set": {"read": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"message": "Message marked as read"}

@api_router.delete("/admin/messages/{message_id}")
async def admin_delete_message(message_id: str, admin=Depends(verify_token)):
    """Delete a contact message"""
    result = await db.contact_messages.delete_one({"id": message_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"message": "Message deleted"}

# ==================== EMAIL SETTINGS ====================

@api_router.get("/admin/email-settings")
async def get_email_settings(admin=Depends(verify_token)):
    """Get email provider settings"""
    settings = await db.email_settings.find_one({"id": "default"}, {"_id": 0})
    return settings or {}

@api_router.put("/admin/email-settings")
async def save_email_settings(data: dict, admin=Depends(verify_token)):
    """Save email provider settings"""
    await db.email_settings.update_one(
        {"id": "default"},
        {"$set": {
            "id": "default",
            "provider": data.get("provider", "sendgrid"),
            "sendgrid_api_key": data.get("sendgrid_api_key", ""),
            "sendgrid_sender_email": data.get("sendgrid_sender_email", ""),
            "sendgrid_sender_name": data.get("sendgrid_sender_name", "Silwer Lining Photography"),
            "microsoft_tenant_id": data.get("microsoft_tenant_id", ""),
            "microsoft_client_id": data.get("microsoft_client_id", ""),
            "microsoft_client_secret": data.get("microsoft_client_secret", ""),
            "microsoft_sender_email": data.get("microsoft_sender_email", ""),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"message": "Settings saved"}

@api_router.post("/admin/email-settings/test")
async def test_email_settings(data: dict, admin=Depends(verify_token)):
    """Send a test email using configured provider"""
    test_email = data.get("email")
    if not test_email:
        raise HTTPException(status_code=400, detail="Email address required")
    
    success = await send_email(
        to_email=test_email,
        subject="Test Email - Silwer Lining Photography",
        html_content="""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #A69F95;">Test Email Successful!</h2>
            <p>Your email configuration is working correctly.</p>
            <p style="color: #888; font-size: 12px; margin-top: 30px;">
                Sent from Silwer Lining Photography booking system
            </p>
        </body>
        </html>
        """
    )
    
    if success:
        return {"message": "Test email sent successfully!"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send email. Check your settings.")

async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send email using configured provider (Microsoft Graph or SendGrid)"""
    try:
        settings = await db.email_settings.find_one({"id": "default"}, {"_id": 0})
        provider = settings.get("provider", "sendgrid") if settings else "sendgrid"
        
        if provider == "microsoft" and settings:
            return await send_email_microsoft(
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                settings=settings
            )
        else:
            return await send_email_sendgrid(
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                settings=settings
            )
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return False

async def send_email_microsoft(to_email: str, subject: str, html_content: str, settings: dict) -> bool:
    """Send email via Microsoft Graph API"""
    import httpx
    
    tenant_id = settings.get("microsoft_tenant_id")
    client_id = settings.get("microsoft_client_id")
    client_secret = settings.get("microsoft_client_secret")
    sender_email = settings.get("microsoft_sender_email")
    
    if not all([tenant_id, client_id, client_secret, sender_email]):
        logger.error("Microsoft Graph: Missing configuration")
        return False
    
    try:
        # Get access token
        token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
        token_data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials"
        }
        
        async with httpx.AsyncClient() as client:
            token_response = await client.post(token_url, data=token_data)
            if token_response.status_code != 200:
                logger.error(f"Microsoft Graph token error: {token_response.text}")
                return False
            
            access_token = token_response.json().get("access_token")
            
            # Send email
            send_url = f"https://graph.microsoft.com/v1.0/users/{sender_email}/sendMail"
            email_data = {
                "message": {
                    "subject": subject,
                    "body": {
                        "contentType": "HTML",
                        "content": html_content
                    },
                    "toRecipients": [
                        {"emailAddress": {"address": to_email}}
                    ]
                },
                "saveToSentItems": "true"
            }
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            send_response = await client.post(send_url, json=email_data, headers=headers)
            
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
    # Get API key from settings or environment
    api_key = settings.get("sendgrid_api_key") if settings else None
    sender_email = settings.get("sendgrid_sender_email") if settings else None
    sender_name = settings.get("sendgrid_sender_name", "Silwer Lining Photography") if settings else "Silwer Lining Photography"
    
    # Fallback to environment variables
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

# ==================== ADMIN - STATS ====================

@api_router.get("/admin/stats")
async def admin_get_stats(admin=Depends(verify_token)):
    """Get dashboard statistics"""
    total_bookings = await db.bookings.count_documents({})
    pending_bookings = await db.bookings.count_documents({"status": "pending"})
    confirmed_bookings = await db.bookings.count_documents({"status": "confirmed"})
    completed_bookings = await db.bookings.count_documents({"status": "completed"})
    portfolio_count = await db.portfolio.count_documents({})
    testimonials_count = await db.testimonials.count_documents({"approved": True})
    unread_messages = await db.contact_messages.count_documents({"read": False})
    packages_count = await db.packages.count_documents({"active": True})
    
    return {
        "total_bookings": total_bookings,
        "pending_bookings": pending_bookings,
        "confirmed_bookings": confirmed_bookings,
        "completed_bookings": completed_bookings,
        "portfolio_count": portfolio_count,
        "testimonials_count": testimonials_count,
        "unread_messages": unread_messages,
        "packages_count": packages_count
    }

# ==================== ADMIN - ADD-ONS ====================

@api_router.get("/admin/addons")
async def admin_get_addons(admin=Depends(verify_token)):
    """Get all add-ons"""
    items = await db.addons.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return items

@api_router.get("/addons")
async def get_public_addons(session_type: Optional[str] = None):
    """Get active add-ons, optionally filtered by session type"""
    query = {"active": True}
    items = await db.addons.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    if session_type:
        items = [item for item in items if not item.get("categories") or session_type in item.get("categories", [])]
    return items

@api_router.post("/admin/addons")
async def admin_create_addon(data: AddOnCreate, admin=Depends(verify_token)):
    """Create a new add-on"""
    addon = AddOn(**data.model_dump())
    doc = addon.model_dump()
    await db.addons.insert_one(doc)
    return addon

@api_router.put("/admin/addons/{addon_id}")
async def admin_update_addon(addon_id: str, data: AddOnCreate, admin=Depends(verify_token)):
    """Update an add-on"""
    update_data = data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.addons.update_one(
        {"id": addon_id},
        {"$set": update_data}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Add-on not found")
    return {"message": "Add-on updated"}

@api_router.delete("/admin/addons/{addon_id}")
async def admin_delete_addon(addon_id: str, admin=Depends(verify_token)):
    """Delete an add-on"""
    result = await db.addons.delete_one({"id": addon_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Add-on not found")
    return {"message": "Add-on deleted"}

# ==================== ADMIN - EMAIL TEMPLATES ====================

@api_router.get("/admin/email-templates")
async def admin_get_email_templates(admin=Depends(verify_token)):
    """Get all email templates"""
    templates = await db.email_templates.find({}, {"_id": 0}).to_list(50)
    return templates

@api_router.get("/admin/email-templates/{template_name}")
async def admin_get_email_template(template_name: str, admin=Depends(verify_token)):
    """Get a specific email template by name"""
    template = await db.email_templates.find_one({"name": template_name}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@api_router.post("/admin/email-templates")
async def admin_create_email_template(data: EmailTemplateCreate, admin=Depends(verify_token)):
    """Create a new email template"""
    # Check if template with same name exists
    existing = await db.email_templates.find_one({"name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="Template with this name already exists")
    
    template = EmailTemplate(**data.model_dump())
    template.display_name = data.name.replace("_", " ").title()
    doc = template.model_dump()
    await db.email_templates.insert_one(doc)
    return template

@api_router.put("/admin/email-templates/{template_id}")
async def admin_update_email_template(template_id: str, data: EmailTemplateCreate, admin=Depends(verify_token)):
    """Update an email template"""
    update_data = data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["display_name"] = data.name.replace("_", " ").title()
    result = await db.email_templates.update_one(
        {"id": template_id},
        {"$set": update_data}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template updated"}

@api_router.delete("/admin/email-templates/{template_id}")
async def admin_delete_email_template(template_id: str, admin=Depends(verify_token)):
    """Delete an email template"""
    result = await db.email_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}

# ==================== ADMIN - STORAGE SETTINGS ====================

@api_router.get("/admin/storage-settings")
async def admin_get_storage_settings(admin=Depends(verify_token)):
    """Get storage settings"""
    settings = await db.storage_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        return {
            "id": "default",
            "provider": "cloudflare_r2",
            "account_id": "",
            "access_key_id": "",
            "secret_access_key": "",
            "bucket_name": "",
            "public_url": ""
        }
    # Mask the secret key for security
    if settings.get("secret_access_key"):
        settings["secret_access_key"] = "••••••••" + settings["secret_access_key"][-4:] if len(settings["secret_access_key"]) > 4 else "••••••••"
    return settings

@api_router.put("/admin/storage-settings")
async def admin_update_storage_settings(data: StorageSettingsUpdate, admin=Depends(verify_token)):
    """Update storage settings"""
    update_data = data.model_dump()
    
    # If secret key is masked, don't update it
    if update_data.get("secret_access_key", "").startswith("••••"):
        existing = await db.storage_settings.find_one({"id": "default"})
        if existing:
            update_data["secret_access_key"] = existing.get("secret_access_key", "")
    
    await db.storage_settings.update_one(
        {"id": "default"},
        {"$set": update_data},
        upsert=True
    )
    return {"message": "Storage settings updated"}

# ==================== ADMIN - INSTAGRAM SETTINGS ====================

@api_router.get("/admin/instagram-settings")
async def admin_get_instagram_settings(admin=Depends(verify_token)):
    """Get Instagram settings"""
    settings = await db.instagram_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        return {
            "id": "default",
            "access_token": "",
            "enabled": True,
            "post_count": 6
        }
    # Mask the token for security
    if settings.get("access_token"):
        token = settings["access_token"]
        settings["access_token"] = token[:10] + "••••••••" + token[-4:] if len(token) > 14 else "••••••••"
    return settings

@api_router.put("/admin/instagram-settings")
async def admin_update_instagram_settings(data: InstagramSettingsUpdate, admin=Depends(verify_token)):
    """Update Instagram settings"""
    update_data = data.model_dump()
    
    # If token is masked, don't update it
    if "••••" in update_data.get("access_token", ""):
        existing = await db.instagram_settings.find_one({"id": "default"})
        if existing:
            update_data["access_token"] = existing.get("access_token", "")
    
    await db.instagram_settings.update_one(
        {"id": "default"},
        {"$set": update_data},
        upsert=True
    )
    return {"message": "Instagram settings updated"}

@api_router.get("/instagram/feed")
async def get_instagram_feed():
    """Get Instagram feed for public display"""
    settings = await db.instagram_settings.find_one({"id": "default"})
    if not settings or not settings.get("enabled") or not settings.get("access_token"):
        return {"posts": [], "error": "Instagram not configured"}
    
    try:
        access_token = settings["access_token"]
        post_count = settings.get("post_count", 6)
        
        async with httpx.AsyncClient() as client:
            # Get user media
            response = await client.get(
                f"https://graph.instagram.com/me/media",
                params={
                    "fields": "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
                    "access_token": access_token,
                    "limit": post_count
                },
                timeout=10.0
            )
            
            if response.status_code != 200:
                logger.error(f"Instagram API error: {response.text}")
                return {"posts": [], "error": "Failed to fetch Instagram feed"}
            
            data = response.json()
            posts = data.get("data", [])
            
            # Filter to only images and carousels (not videos for now)
            filtered_posts = [
                {
                    "id": post["id"],
                    "image_url": post.get("media_url") or post.get("thumbnail_url"),
                    "caption": post.get("caption", "")[:100] if post.get("caption") else "",
                    "permalink": post.get("permalink"),
                    "timestamp": post.get("timestamp")
                }
                for post in posts
                if post.get("media_type") in ["IMAGE", "CAROUSEL_ALBUM"]
            ]
            
            return {"posts": filtered_posts}
    except Exception as e:
        logger.error(f"Instagram feed error: {str(e)}")
        return {"posts": [], "error": str(e)}

# ==================== FILE UPLOAD (Cloudflare R2) ====================

@api_router.post("/admin/upload")
async def admin_upload_file(admin=Depends(verify_token)):
    """Get presigned URL for file upload to R2"""
    from fastapi import UploadFile, File
    # This endpoint would be used with multipart form data
    # For now, we'll implement a simple presigned URL approach
    
    settings = await db.storage_settings.find_one({"id": "default"})
    if not settings or not settings.get("access_key_id"):
        raise HTTPException(status_code=400, detail="Storage not configured. Please configure R2 settings first.")
    
    return {"message": "Use /admin/upload-image endpoint with multipart form data"}

from fastapi import UploadFile, File
import base64

@api_router.post("/admin/upload-image")
async def admin_upload_image(
    file: UploadFile = File(...),
    admin=Depends(verify_token)
):
    """Upload image to Cloudflare R2"""
    import boto3
    from botocore.config import Config
    
    settings = await db.storage_settings.find_one({"id": "default"})
    if not settings or not settings.get("access_key_id"):
        raise HTTPException(status_code=400, detail="Storage not configured. Please configure R2 settings in admin.")
    
    try:
        # Configure S3-compatible client for R2
        s3_client = boto3.client(
            's3',
            endpoint_url=f"https://{settings['account_id']}.r2.cloudflarestorage.com",
            aws_access_key_id=settings['access_key_id'],
            aws_secret_access_key=settings['secret_access_key'],
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )
        
        # Generate unique filename
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        unique_filename = f"portfolio/{uuid.uuid4()}.{file_ext}"
        
        # Read file content
        content = await file.read()
        
        # Upload to R2
        s3_client.put_object(
            Bucket=settings['bucket_name'],
            Key=unique_filename,
            Body=content,
            ContentType=file.content_type or 'image/jpeg'
        )
        
        # Construct public URL
        public_url = settings.get('public_url', '').rstrip('/')
        if public_url:
            image_url = f"{public_url}/{unique_filename}"
        else:
            image_url = f"https://{settings['bucket_name']}.{settings['account_id']}.r2.cloudflarestorage.com/{unique_filename}"
        
        return {"success": True, "url": image_url, "filename": unique_filename}
        
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@api_router.post("/admin/upload-images")
async def admin_upload_multiple_images(
    files: List[UploadFile] = File(...),
    category: str = Query(...),
    admin=Depends(verify_token)
):
    """Upload multiple images to R2 and create portfolio entries"""
    import boto3
    from botocore.config import Config
    
    settings = await db.storage_settings.find_one({"id": "default"})
    if not settings or not settings.get("access_key_id"):
        raise HTTPException(status_code=400, detail="Storage not configured. Please configure R2 settings in admin.")
    
    try:
        s3_client = boto3.client(
            's3',
            endpoint_url=f"https://{settings['account_id']}.r2.cloudflarestorage.com",
            aws_access_key_id=settings['access_key_id'],
            aws_secret_access_key=settings['secret_access_key'],
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )
        
        uploaded = []
        public_url = settings.get('public_url', '').rstrip('/')
        
        for file in files:
            file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
            unique_filename = f"portfolio/{uuid.uuid4()}.{file_ext}"
            
            content = await file.read()
            
            s3_client.put_object(
                Bucket=settings['bucket_name'],
                Key=unique_filename,
                Body=content,
                ContentType=file.content_type or 'image/jpeg'
            )
            
            if public_url:
                image_url = f"{public_url}/{unique_filename}"
            else:
                image_url = f"https://{settings['bucket_name']}.{settings['account_id']}.r2.cloudflarestorage.com/{unique_filename}"
            
            # Create portfolio entry
            portfolio_item = Portfolio(
                title=file.filename.rsplit('.', 1)[0] if '.' in file.filename else file.filename,
                category=category,
                image_url=image_url
            )
            doc = portfolio_item.model_dump()
            await db.portfolio.insert_one(doc)
            
            uploaded.append({
                "id": portfolio_item.id,
                "url": image_url,
                "filename": file.filename,
                "category": category
            })
        
        return {"success": True, "uploaded": uploaded, "count": len(uploaded)}
        
    except Exception as e:
        logger.error(f"Multi-upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

# ==================== FAQ ENDPOINTS ====================

@api_router.get("/faqs")
async def get_faqs(category: Optional[str] = None):
    """Get all active FAQs, optionally filtered by category"""
    query = {"active": True}
    if category:
        query["category"] = category
    items = await db.faqs.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    return items

@api_router.get("/admin/faqs")
async def admin_get_faqs(admin=Depends(verify_token)):
    """Get all FAQs for admin"""
    items = await db.faqs.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return items

@api_router.post("/admin/faqs")
async def admin_create_faq(data: FAQCreate, admin=Depends(verify_token)):
    """Create a new FAQ"""
    faq = FAQ(**data.model_dump())
    doc = faq.model_dump()
    await db.faqs.insert_one(doc)
    return faq

@api_router.put("/admin/faqs/{faq_id}")
async def admin_update_faq(faq_id: str, data: FAQCreate, admin=Depends(verify_token)):
    """Update an FAQ"""
    update_data = data.model_dump()
    result = await db.faqs.update_one(
        {"id": faq_id},
        {"$set": update_data}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="FAQ not found")
    return {"message": "FAQ updated"}

@api_router.delete("/admin/faqs/{faq_id}")
async def admin_delete_faq(faq_id: str, admin=Depends(verify_token)):
    """Delete an FAQ"""
    result = await db.faqs.delete_one({"id": faq_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="FAQ not found")
    return {"message": "FAQ deleted"}

@api_router.put("/admin/faqs/reorder")
async def admin_reorder_faqs(faq_orders: List[dict], admin=Depends(verify_token)):
    """Reorder FAQs - expects [{id: "xxx", order: 0}, ...]"""
    for item in faq_orders:
        await db.faqs.update_one(
            {"id": item["id"]},
            {"$set": {"order": item["order"]}}
        )
    return {"message": "FAQs reordered"}

# ==================== ADMIN - QUESTIONNAIRES ====================

@api_router.get("/admin/questionnaires")
async def admin_get_questionnaires(admin=Depends(verify_token)):
    """Get all questionnaires"""
    items = await db.questionnaires.find({}, {"_id": 0}).to_list(100)
    return items

@api_router.get("/admin/questionnaires/{session_type}")
async def admin_get_questionnaire_by_type(session_type: str, admin=Depends(verify_token)):
    """Get questionnaire for a specific session type"""
    item = await db.questionnaires.find_one({"session_type": session_type}, {"_id": 0})
    if not item:
        # Return empty questionnaire structure
        return {
            "session_type": session_type,
            "title": "",
            "description": "",
            "questions": [],
            "active": False
        }
    return item

@api_router.get("/questionnaire/{session_type}")
async def get_public_questionnaire(session_type: str):
    """Get active questionnaire for a session type (public endpoint for booking)"""
    item = await db.questionnaires.find_one(
        {"session_type": session_type, "active": True}, 
        {"_id": 0}
    )
    if not item:
        return {"questions": []}
    return item

@api_router.post("/admin/questionnaires")
async def admin_create_questionnaire(data: QuestionnaireCreate, admin=Depends(verify_token)):
    """Create or update a questionnaire for a session type"""
    # Check if questionnaire already exists for this session type
    existing = await db.questionnaires.find_one({"session_type": data.session_type})
    
    if existing:
        # Update existing
        update_data = data.model_dump()
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.questionnaires.update_one(
            {"session_type": data.session_type},
            {"$set": update_data}
        )
        return {"message": "Questionnaire updated", "session_type": data.session_type}
    else:
        # Create new
        questionnaire = Questionnaire(**data.model_dump())
        doc = questionnaire.model_dump()
        await db.questionnaires.insert_one(doc)
        return {"message": "Questionnaire created", "id": questionnaire.id}

@api_router.put("/admin/questionnaires/{questionnaire_id}")
async def admin_update_questionnaire(questionnaire_id: str, data: QuestionnaireCreate, admin=Depends(verify_token)):
    """Update a questionnaire"""
    update_data = data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.questionnaires.update_one(
        {"id": questionnaire_id},
        {"$set": update_data}
    )
    if result.modified_count == 0:
        # Try updating by session_type
        result = await db.questionnaires.update_one(
            {"session_type": data.session_type},
            {"$set": update_data}
        )
    return {"message": "Questionnaire updated"}

@api_router.delete("/admin/questionnaires/{questionnaire_id}")
async def admin_delete_questionnaire(questionnaire_id: str, admin=Depends(verify_token)):
    """Delete a questionnaire"""
    result = await db.questionnaires.delete_one({"id": questionnaire_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Questionnaire not found")
    return {"message": "Questionnaire deleted"}

# ==================== CONTRACT ENDPOINTS ====================

@api_router.get("/contract")
async def get_public_contract():
    """Get the contract template for booking flow (public endpoint)"""
    contract = await db.contract_template.find_one({"id": "default"}, {"_id": 0})
    if not contract:
        # Return default empty contract
        return {
            "id": "default",
            "title": "Photography Session Contract",
            "content": "",
            "smart_fields": []
        }
    return contract

@api_router.get("/admin/contract")
async def admin_get_contract(admin=Depends(verify_token)):
    """Get the contract template for admin editing"""
    contract = await db.contract_template.find_one({"id": "default"}, {"_id": 0})
    if not contract:
        # Return default empty contract with sample content
        return {
            "id": "default",
            "title": "Photography Session Contract",
            "content": """<h2>Photography Session Agreement</h2>
<p>This agreement is entered into between Silwer Lining Photography ("Photographer") and the client ("Client").</p>

<h3>1. Session Details</h3>
<p>The Photographer agrees to provide photography services as selected in the booking.</p>

<h3>2. Payment Terms</h3>
<p>A deposit is required to secure your booking date. The remaining balance is due on the day of the session.</p>

<p>I acknowledge and agree to the payment terms:</p>
{{AGREE_PAYMENT}}

<h3>3. Cancellation Policy</h3>
<p>Cancellations must be made at least 48 hours before the scheduled session. Deposits are non-refundable.</p>

<p>I understand and accept the cancellation policy:</p>
{{AGREE_CANCELLATION}}

<h3>4. Image Usage Rights</h3>
<p>The Photographer retains copyright of all images. Client receives a license for personal use. The Photographer may use images for portfolio, social media, and promotional purposes unless otherwise agreed.</p>

<p>I agree to the image usage terms:</p>
{{AGREE_USAGE}}

<p>Please initial here to confirm you have read this section:</p>
{{INITIALS_USAGE}}

<h3>5. Agreement</h3>
<p>By signing below, I confirm that I have read, understood, and agree to all terms and conditions of this contract.</p>

<p>Date:</p>
{{DATE_SIGNED}}

<p>Client Signature:</p>
{{SIGNATURE}}""",
            "smart_fields": [
                {"id": "AGREE_PAYMENT", "type": "agree_disagree", "label": "I agree to the payment terms", "required": True},
                {"id": "AGREE_CANCELLATION", "type": "agree_disagree", "label": "I accept the cancellation policy", "required": True},
                {"id": "AGREE_USAGE", "type": "agree_disagree", "label": "I agree to the image usage terms", "required": True},
                {"id": "INITIALS_USAGE", "type": "initials", "label": "Initials", "required": True},
                {"id": "DATE_SIGNED", "type": "date", "label": "Date", "required": True},
                {"id": "SIGNATURE", "type": "signature", "label": "Signature", "required": True}
            ],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    return contract

@api_router.put("/admin/contract")
async def admin_update_contract(data: dict, admin=Depends(verify_token)):
    """Update the contract template"""
    update_data = {
        "id": "default",
        "title": data.get("title", "Photography Session Contract"),
        "content": data.get("content", ""),
        "smart_fields": data.get("smart_fields", []),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.contract_template.update_one(
        {"id": "default"},
        {"$set": update_data},
        upsert=True
    )
    return {"message": "Contract template updated"}

@api_router.get("/admin/bookings/{booking_id}/contract")
async def admin_get_booking_contract(booking_id: str, admin=Depends(verify_token)):
    """Get the signed contract data for a specific booking"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if not booking.get("contract_signed"):
        return {"signed": False, "message": "Contract not signed"}
    
    # Get the contract template to show with responses
    contract = await db.contract_template.find_one({"id": "default"}, {"_id": 0})
    
    return {
        "signed": True,
        "contract_data": booking.get("contract_data", {}),
        "contract_template": contract,
        "client_name": booking.get("client_name"),
        "signed_at": booking.get("contract_data", {}).get("signed_at")
    }

@api_router.get("/admin/bookings/{booking_id}/contract/pdf")
async def admin_download_booking_contract_pdf(booking_id: str, admin=Depends(verify_token)):
    """Generate and download the signed contract as PDF"""
    from fastapi.responses import Response
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if not booking.get("contract_signed"):
        raise HTTPException(status_code=400, detail="Contract not signed")
    
    # Get the contract template
    contract_template = await db.contract_template.find_one({"id": "default"}, {"_id": 0})
    if not contract_template:
        raise HTTPException(status_code=404, detail="Contract template not found")
    
    # Generate PDF
    pdf_bytes = await generate_contract_pdf(booking, contract_template)
    if not pdf_bytes:
        raise HTTPException(status_code=500, detail="Failed to generate PDF")
    
    # Return as downloadable file
    filename = f"contract_{booking.get('client_name', 'client').replace(' ', '_')}_{booking.get('booking_date', 'booking')}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

# ==================== PAYMENT ENDPOINTS ====================

def calculate_payfast_signature(data: dict) -> str:
    """Calculate MD5 signature for PayFast (using env vars - legacy)"""
    return calculate_payfast_signature_with_creds(data, PAYFAST_PASSPHRASE)

def calculate_payfast_signature_with_creds(data: dict, passphrase: str = "") -> str:
    """Calculate MD5 signature for PayFast with custom passphrase"""
    # Field order as per PayFast documentation
    field_order = [
        "merchant_id", "merchant_key", "return_url", "cancel_url", "notify_url",
        "name_first", "name_last", "email_address", "cell_number",
        "m_payment_id", "amount", "item_name", "item_description",
        "custom_str1", "custom_str2", "custom_str3", "custom_str4", "custom_str5",
        "custom_int1", "custom_int2", "custom_int3", "custom_int4", "custom_int5",
        "email_confirmation", "confirmation_address", "payment_method"
    ]
    
    # Build parameter string in correct order
    params = []
    for field in field_order:
        if field in data and data[field] is not None and str(data[field]).strip() != "":
            # URL encode the value, but PayFast expects spaces as + not %20
            value = str(data[field]).strip()
            encoded_value = urllib.parse.quote_plus(value)
            params.append(f"{field}={encoded_value}")
    
    pf_string = "&".join(params)
    
    # Add passphrase only if it's set and not empty
    passphrase_clean = passphrase.strip() if passphrase else ""
    if passphrase_clean:
        pf_string += f"&passphrase={urllib.parse.quote_plus(passphrase_clean)}"
    
    # Generate MD5 hash
    return hashlib.md5(pf_string.encode()).hexdigest()

async def verify_payfast_signature_async(data: dict, signature: str) -> bool:
    """Verify ITN signature from PayFast using database credentials"""
    pf_creds = await get_payfast_credentials()
    
    # Build parameter string (excluding signature)
    params = []
    for key, value in data.items():
        if key != "signature" and value is not None and str(value).strip() != "":
            encoded_value = urllib.parse.quote_plus(str(value).strip())
            params.append(f"{key}={encoded_value}")
    
    pf_string = "&".join(params)
    
    # Add passphrase if set
    passphrase = pf_creds["passphrase"].strip() if pf_creds["passphrase"] else ""
    if passphrase:
        pf_string += f"&passphrase={urllib.parse.quote_plus(passphrase)}"
    
    # Generate MD5 hash
    calculated = hashlib.md5(pf_string.encode()).hexdigest()
    
    logger.info(f"ITN Signature verification - Received: {signature}, Calculated: {calculated}")
    
    return calculated.lower() == signature.lower()

def verify_payfast_signature(data: dict, signature: str) -> bool:
    """Verify ITN signature from PayFast (sync version using env vars)"""
    # Build parameter string (excluding signature)
    params = []
    for key, value in data.items():
        if key != "signature" and value is not None and str(value).strip() != "":
            encoded_value = urllib.parse.quote_plus(str(value).strip())
            params.append(f"{key}={encoded_value}")
    
    pf_string = "&".join(params)
    
    # Add passphrase if set
    passphrase = PAYFAST_PASSPHRASE.strip() if PAYFAST_PASSPHRASE else ""
    if passphrase:
        pf_string += f"&passphrase={urllib.parse.quote_plus(passphrase)}"
    
    calculated = hashlib.md5(pf_string.encode()).hexdigest()
    logger.info(f"ITN Signature verification - Received: {signature}, Calculated: {calculated}")
    return calculated.lower() == signature.lower()

@api_router.post("/payments/payfast-itn")
async def handle_payfast_itn(request: Request):
    """Handle PayFast ITN (Instant Transaction Notification) webhook"""
    try:
        # Parse form data
        form_data = await request.form()
        data = dict(form_data)
        
        logger.info(f"PayFast ITN received: {data}")
        
        # Get booking ID first (before signature verification)
        booking_id = data.get("m_payment_id")
        if not booking_id:
            logger.error("PayFast ITN: No booking ID (m_payment_id)")
            return Response(content="No booking ID", status_code=400)
        
        # Get PayFast credentials from database
        pf_creds = await get_payfast_credentials()
        
        # Verify merchant ID matches the configured one
        received_merchant_id = data.get("merchant_id")
        if received_merchant_id != pf_creds["merchant_id"]:
            logger.error(f"PayFast ITN: Invalid merchant ID. Expected {pf_creds['merchant_id']}, got {received_merchant_id}")
            return Response(content="Invalid merchant", status_code=400)
        
        # Verify signature using credentials from database
        signature = data.get("signature", "")
        sig_valid = await verify_payfast_signature_async(data, signature)
        if not sig_valid:
            if pf_creds["is_sandbox"]:
                logger.warning(f"PayFast ITN: Signature mismatch for booking {booking_id} - proceeding anyway (sandbox mode)")
            else:
                logger.error(f"PayFast ITN: Signature mismatch for booking {booking_id} - rejecting (live mode)")
                return Response(content="Invalid signature", status_code=400)
        
        # Get booking
        booking = await db.bookings.find_one({"id": booking_id})
        if not booking:
            logger.error(f"PayFast ITN: Booking not found: {booking_id}")
            return Response(content="Booking not found", status_code=404)
        
        # Process payment status
        payment_status = data.get("payment_status", "")
        pf_payment_id = data.get("pf_payment_id", "")
        amount_gross = float(data.get("amount_gross", 0))
        
        logger.info(f"PayFast ITN: Processing payment for booking {booking_id}, status: {payment_status}")
        
        if payment_status == "COMPLETE":
            # Payment successful - amount is in Rands, store as Rands (not cents)
            await db.bookings.update_one(
                {"id": booking_id},
                {"$set": {
                    "payment_status": "complete",
                    "pf_payment_id": pf_payment_id,
                    "amount_paid": amount_gross,  # Store in Rands
                    "status": "confirmed",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            logger.info(f"PayFast ITN: Booking {booking_id} confirmed with payment {pf_payment_id}")
            
            # TODO: Send confirmation email
            
        elif payment_status == "FAILED":
            await db.bookings.update_one(
                {"id": booking_id},
                {"$set": {
                    "payment_status": "failed",
                    "status": "payment_failed",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            logger.info(f"PayFast ITN: Payment failed for booking {booking_id}")
            
        elif payment_status == "PENDING":
            await db.bookings.update_one(
                {"id": booking_id},
                {"$set": {
                    "payment_status": "pending",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            logger.info(f"PayFast ITN: Payment pending for booking {booking_id}")
        
        # Return 200 OK to acknowledge receipt
        return Response(content="OK", status_code=200)
        
    except Exception as e:
        logger.error(f"PayFast ITN error: {str(e)}")
        return Response(content="Server error", status_code=500)
async def get_payment_settings():
    """Get payment settings (public - for booking flow)"""
    settings = await db.payment_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        settings = {
            "bank_name": "",
            "account_holder": "",
            "account_number": "",
            "branch_code": "",
            "account_type": "",
            "payfast_enabled": True,
            "payflex_enabled": False
        }
    # Don't expose sensitive fields
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

@api_router.get("/admin/payment-settings")
async def admin_get_payment_settings(admin=Depends(verify_token)):
    """Get full payment settings for admin"""
    settings = await db.payment_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        return PaymentSettings().model_dump()
    return settings

@api_router.put("/admin/payment-settings")
async def admin_update_payment_settings(data: dict, admin=Depends(verify_token)):
    """Update payment settings"""
    data["id"] = "default"
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.payment_settings.update_one(
        {"id": "default"},
        {"$set": data},
        upsert=True
    )
    return {"message": "Payment settings updated"}

@api_router.post("/payments/initiate")
async def initiate_payment(data: dict):
    """Initiate a payment for a booking"""
    booking_id = data.get("booking_id")
    payment_method = data.get("payment_method")  # payfast, payflex, eft
    payment_type = data.get("payment_type", "deposit")  # deposit or full
    
    # Get booking
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    total_price = booking.get("total_price", 0)
    amount = total_price if payment_type == "full" else int(total_price * 0.5)
    
    # Update booking with payment info
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "payment_method": payment_method,
            "payment_type": payment_type,
            "payment_status": "pending",
            "status": "awaiting_payment" if payment_method != "eft" else "awaiting_eft",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if payment_method == "payfast":
        # Get PayFast credentials from database settings
        pf_creds = await get_payfast_credentials()
        
        # Generate PayFast payment form data
        frontend_url = os.environ.get('REACT_APP_BACKEND_URL', 'https://booking-mgmt-suite.preview.emergentagent.com').replace('/api', '')
        backend_url = os.environ.get('REACT_APP_BACKEND_URL', 'https://booking-mgmt-suite.preview.emergentagent.com')
        
        # Split name
        name_parts = booking.get("client_name", "").split(" ", 1)
        first_name = name_parts[0].strip() if name_parts else "Customer"
        last_name = name_parts[1].strip() if len(name_parts) > 1 else "Customer"
        
        # Format cell number for South Africa (must be 10 digits starting with 0)
        cell_raw = booking.get("client_phone", "").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        if cell_raw.startswith("+27"):
            cell_number = "0" + cell_raw[3:]
        elif cell_raw.startswith("27"):
            cell_number = "0" + cell_raw[2:]
        elif cell_raw.startswith("0"):
            cell_number = cell_raw
        else:
            cell_number = cell_raw
        # Ensure only digits
        cell_number = ''.join(filter(str.isdigit, cell_number))
        
        # Amount - prices in database are in Rands (not cents), format with 2 decimals
        amount_rands = float(amount) if amount >= 100 else float(amount)
        amount_str = f"{amount_rands:.2f}"
        
        form_data = {
            "merchant_id": pf_creds["merchant_id"],
            "merchant_key": pf_creds["merchant_key"],
            "return_url": f"{frontend_url}/payment/return?booking_id={booking_id}",
            "cancel_url": f"{frontend_url}/payment/cancel?booking_id={booking_id}",
            "notify_url": f"{backend_url}/api/payments/payfast-itn",
            "name_first": first_name,
            "name_last": last_name,
            "email_address": booking.get("client_email", ""),
            "m_payment_id": booking_id,
            "amount": amount_str,
            "item_name": f"{booking.get('session_type', 'Photography').title()} Session",
            "item_description": f"{booking.get('package_name', 'Package')} - {'Deposit' if payment_type == 'deposit' else 'Full Payment'}",
        }
        
        # Only add cell_number if valid (10 digits)
        if cell_number and len(cell_number) == 10:
            form_data["cell_number"] = cell_number
        
        # Calculate signature using credentials from settings
        form_data["signature"] = calculate_payfast_signature_with_creds(form_data, pf_creds["passphrase"])
        
        return {
            "payment_method": "payfast",
            "payment_url": pf_creds["url"],
            "form_data": form_data,
            "amount": amount,
            "is_sandbox": pf_creds["is_sandbox"]
        }
    
    elif payment_method == "eft":
        # Get bank details
        settings = await db.payment_settings.find_one({"id": "default"}, {"_id": 0})
        reference = settings.get("reference_format", "BOOKING-{booking_id}").replace("{booking_id}", booking_id[:8].upper())
        
        return {
            "payment_method": "eft",
            "bank_details": {
                "bank_name": settings.get("bank_name", ""),
                "account_holder": settings.get("account_holder", ""),
                "account_number": settings.get("account_number", ""),
                "branch_code": settings.get("branch_code", ""),
                "account_type": settings.get("account_type", ""),
                "reference": reference
            },
            "amount": amount
        }
    
    elif payment_method == "payflex":
        # Placeholder for PayFlex integration
        return {
            "payment_method": "payflex",
            "message": "PayFlex integration coming soon",
            "amount": amount
        }
    
    else:
        raise HTTPException(status_code=400, detail="Invalid payment method")

@api_router.get("/payments/status/{booking_id}")
async def get_payment_status(booking_id: str):
    """Get payment status for a booking"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    return {
        "booking_id": booking_id,
        "status": booking.get("status"),
        "payment_status": booking.get("payment_status"),
        "payment_method": booking.get("payment_method"),
        "payment_type": booking.get("payment_type"),
        "amount_paid": booking.get("amount_paid", 0),
        "total_price": booking.get("total_price", 0),
        "session_type": booking.get("session_type", ""),
        "package_name": booking.get("package_name", ""),
        "manage_token": booking.get("manage_token", booking.get("token", ""))
    }

@api_router.post("/payments/verify")
async def verify_payment_with_payfast(data: dict):
    """Verify payment status with PayFast API"""
    booking_id = data.get("booking_id")
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # If already confirmed, return success
    if booking.get("payment_status") == "complete" or booking.get("status") == "confirmed":
        return {
            "verified": True,
            "status": "complete",
            "message": "Payment already confirmed"
        }
    
    # Only verify PayFast payments
    if booking.get("payment_method") != "payfast":
        return {
            "verified": False,
            "status": booking.get("payment_status", "unknown"),
            "message": "Not a PayFast payment"
        }
    
    # Get PayFast credentials from database
    pf_creds = await get_payfast_credentials()
    
    # Query PayFast to verify payment
    try:
        import httpx
        
        # Build verification request
        validate_url = "https://sandbox.payfast.co.za/eng/query/validate" if pf_creds["is_sandbox"] else "https://www.payfast.co.za/eng/query/validate"
        
        # Prepare data for verification
        verify_data = {
            "merchant_id": pf_creds["merchant_id"],
            "merchant_key": pf_creds["merchant_key"],
            "m_payment_id": booking_id
        }
        
        # Calculate signature for verification request
        pf_string = "&".join([f"{k}={urllib.parse.quote_plus(str(v))}" for k, v in verify_data.items()])
        if pf_creds["passphrase"]:
            pf_string += f"&passphrase={urllib.parse.quote_plus(pf_creds['passphrase'])}"
        signature = hashlib.md5(pf_string.encode()).hexdigest()
        verify_data["signature"] = signature
        
        async with httpx.AsyncClient() as client:
            response = await client.post(validate_url, data=verify_data, timeout=10.0)
            
            if response.status_code == 200:
                # Parse response - PayFast returns URL-encoded data
                result = {}
                for pair in response.text.split("&"):
                    if "=" in pair:
                        key, value = pair.split("=", 1)
                        result[key] = urllib.parse.unquote_plus(value)
                
                payment_status = result.get("payment_status", "").upper()
                
                if payment_status == "COMPLETE":
                    # Update booking as confirmed
                    total_price = booking.get("total_price", 0)
                    payment_type = booking.get("payment_type", "deposit")
                    amount_paid = total_price if payment_type == "full" else int(total_price * 0.5)
                    
                    await db.bookings.update_one(
                        {"id": booking_id},
                        {"$set": {
                            "payment_status": "complete",
                            "status": "confirmed",
                            "amount_paid": amount_paid,
                            "pf_payment_id": result.get("pf_payment_id", ""),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    return {
                        "verified": True,
                        "status": "complete",
                        "message": "Payment verified successfully"
                    }
                else:
                    return {
                        "verified": False,
                        "status": payment_status.lower() if payment_status else "pending",
                        "message": f"Payment status: {payment_status or 'PENDING'}"
                    }
            else:
                logger.error(f"PayFast verify failed: {response.status_code} - {response.text}")
                return {
                    "verified": False,
                    "status": "unknown",
                    "message": "Could not verify with PayFast"
                }
                
    except Exception as e:
        logger.error(f"PayFast verification error: {str(e)}")
        return {
            "verified": False,
            "status": "error",
            "message": "Verification failed - please contact support"
        }

@api_router.post("/payments/send-reminder")
async def send_payment_reminder(data: dict, admin=Depends(verify_token)):
    """Send payment reminder email to client"""
    booking_id = data.get("booking_id")
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Generate payment link
    frontend_url = os.environ.get('REACT_APP_BACKEND_URL', 'https://booking-mgmt-suite.preview.emergentagent.com').replace('/api', '')
    payment_link = f"{frontend_url}/complete-payment/{booking_id}"
    
    # Send reminder email
    try:
        html_content = f"""
        <html>
        <body style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FDFCF8;">
            <div style="text-align: center; padding: 30px 0; border-bottom: 2px solid #C6A87C;">
                <h1 style="color: #2D2A26; font-size: 28px; margin: 0;">Silwer Lining Photography</h1>
            </div>
            
            <div style="padding: 30px 0;">
                <h2 style="color: #2D2A26;">Payment Reminder</h2>
                <p>Dear {booking['client_name']},</p>
                <p>This is a friendly reminder to complete your payment for your upcoming photography session.</p>
                
                <div style="background-color: #F5F2EE; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Session:</strong> {booking['session_type'].title()}</p>
                    <p><strong>Package:</strong> {booking['package_name']}</p>
                    <p><strong>Date:</strong> {booking['booking_date']}</p>
                    <p><strong>Time:</strong> {booking['booking_time']}</p>
                    <p><strong>Total:</strong> R{booking['total_price'] / 100:,.2f}</p>
                </div>
                
                <p>Click the button below to complete your payment:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{payment_link}" style="background-color: #C6A87C; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">
                        Complete Payment
                    </a>
                </div>
                
                <p style="color: #8A847C; font-size: 14px;">If you have any questions, please don't hesitate to contact us.</p>
            </div>
        </body>
        </html>
        """
        
        message = Mail(
            from_email=SENDER_EMAIL,
            to_emails=booking['client_email'],
            subject=f"Payment Reminder - {booking['session_type'].title()} Session",
            html_content=html_content
        )
        
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        sg.send(message)
        
        return {"message": "Payment reminder sent"}
    except Exception as e:
        logger.error(f"Failed to send payment reminder: {e}")
        raise HTTPException(status_code=500, detail="Failed to send reminder")

# ==================== CLIENT BOOKING MANAGEMENT ====================

@api_router.get("/client/booking/{token}")
async def get_client_booking(token: str):
    """Get booking details for client management page"""
    booking = await db.bookings.find_one(
        {"$or": [{"token": token}, {"manage_token": token}]},
        {"_id": 0}
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get questionnaire for this session type
    questionnaire = await db.questionnaires.find_one(
        {"session_type": booking.get("session_type"), "active": True},
        {"_id": 0}
    )
    
    return {
        "booking": booking,
        "questionnaire": questionnaire
    }

@api_router.post("/client/booking/{token}/questionnaire")
async def save_client_questionnaire(token: str, data: dict):
    """Save questionnaire responses from client"""
    booking = await db.bookings.find_one(
        {"$or": [{"token": token}, {"manage_token": token}]}
    )
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

@api_router.post("/client/booking/{token}/email-questionnaire")
async def email_questionnaire_link(token: str):
    """Send questionnaire link to client email"""
    booking = await db.bookings.find_one(
        {"$or": [{"token": token}, {"manage_token": token}]},
        {"_id": 0}
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if not SENDGRID_API_KEY:
        raise HTTPException(status_code=500, detail="Email not configured")
    
    frontend_url = os.environ.get('REACT_APP_BACKEND_URL', '').replace('/api', '')
    manage_link = f"{frontend_url}/manage/{token}"
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #A69F95;">Complete Your Session Questionnaire</h2>
        <p>Hi {booking.get('client_name', 'there')},</p>
        <p>Please complete your session questionnaire to help us prepare for your upcoming {booking.get('session_type', '').replace('-', ' ').title()} session.</p>
        <p style="margin: 30px 0;">
            <a href="{manage_link}" style="background-color: #A69F95; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                Complete Questionnaire
            </a>
        </p>
        <p style="color: #666; font-size: 14px;">
            <strong>Session Date:</strong> {booking.get('booking_date', 'TBD')}<br>
            <strong>Time:</strong> {booking.get('booking_time', 'TBD')}
        </p>
        <p style="color: #888; font-size: 12px; margin-top: 30px;">
            This link also allows you to manage your booking, request reschedule or cancellation.
        </p>
    </body>
    </html>
    """
    
    try:
        message = Mail(
            from_email=SENDER_EMAIL,
            to_emails=booking['client_email'],
            subject=f"Complete Your Session Questionnaire - Silwer Lining Photography",
            html_content=html_content
        )
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        sg.send(message)
        return {"message": "Email sent"}
    except Exception as e:
        logger.error(f"Failed to send questionnaire email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email")

@api_router.post("/client/booking/{token}/request-reschedule")
async def request_reschedule(token: str):
    """Client requests to reschedule booking"""
    booking = await db.bookings.find_one(
        {"$or": [{"token": token}, {"manage_token": token}]}
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    await db.bookings.update_one(
        {"id": booking["id"]},
        {"$set": {
            "reschedule_requested": True,
            "reschedule_requested_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Send notification to admin
    if SENDGRID_API_KEY:
        try:
            message = Mail(
                from_email=SENDER_EMAIL,
                to_emails=SENDER_EMAIL,
                subject=f"Reschedule Request - {booking.get('client_name')}",
                html_content=f"""
                <p>Client <strong>{booking.get('client_name')}</strong> has requested to reschedule their booking.</p>
                <p><strong>Session:</strong> {booking.get('session_type', '').title()}</p>
                <p><strong>Current Date:</strong> {booking.get('booking_date')} at {booking.get('booking_time')}</p>
                <p><strong>Email:</strong> {booking.get('client_email')}</p>
                <p><strong>Phone:</strong> {booking.get('client_phone')}</p>
                """
            )
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            sg.send(message)
        except Exception as e:
            logger.error(f"Failed to send reschedule notification: {e}")
    
    return {"message": "Reschedule request sent"}

@api_router.post("/client/booking/{token}/request-cancel")
async def request_cancellation(token: str):
    """Client requests to cancel booking"""
    booking = await db.bookings.find_one(
        {"$or": [{"token": token}, {"manage_token": token}]}
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    await db.bookings.update_one(
        {"id": booking["id"]},
        {"$set": {
            "cancellation_requested": True,
            "cancellation_requested_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Send notification to admin
    if SENDGRID_API_KEY:
        try:
            message = Mail(
                from_email=SENDER_EMAIL,
                to_emails=SENDER_EMAIL,
                subject=f"Cancellation Request - {booking.get('client_name')}",
                html_content=f"""
                <p>Client <strong>{booking.get('client_name')}</strong> has requested to cancel their booking.</p>
                <p><strong>Session:</strong> {booking.get('session_type', '').title()}</p>
                <p><strong>Date:</strong> {booking.get('booking_date')} at {booking.get('booking_time')}</p>
                <p><strong>Email:</strong> {booking.get('client_email')}</p>
                """
            )
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            sg.send(message)
        except Exception as e:
            logger.error(f"Failed to send cancellation notification: {e}")
    
    return {"message": "Cancellation request sent"}

# ==================== QUESTIONNAIRE REMINDERS ====================

@api_router.post("/admin/send-questionnaire-reminders")
async def send_questionnaire_reminders(admin=Depends(verify_token)):
    """Send questionnaire reminders for bookings 3 days before session (manual trigger or cron)"""
    from datetime import timedelta
    
    three_days_from_now = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d")
    
    # Find bookings 3 days away without completed questionnaire
    bookings = await db.bookings.find({
        "booking_date": three_days_from_now,
        "questionnaire_completed": {"$ne": True},
        "questionnaire_reminder_sent": {"$ne": True},
        "status": {"$in": ["confirmed", "pending"]}
    }, {"_id": 0}).to_list(100)
    
    sent_count = 0
    for booking in bookings:
        token = booking.get("manage_token") or booking.get("token")
        if token and booking.get("client_email"):
            try:
                # Reuse the email questionnaire function logic
                frontend_url = os.environ.get('REACT_APP_BACKEND_URL', '').replace('/api', '')
                manage_link = f"{frontend_url}/manage/{token}"
                
                html_content = f"""
                <html>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #A69F95;">Reminder: Complete Your Session Questionnaire</h2>
                    <p>Hi {booking.get('client_name', 'there')},</p>
                    <p>Your {booking.get('session_type', '').replace('-', ' ').title()} session is coming up in <strong>3 days</strong>!</p>
                    <p>Please complete your questionnaire so we can prepare for your session.</p>
                    <p style="margin: 30px 0;">
                        <a href="{manage_link}" style="background-color: #A69F95; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                            Complete Questionnaire Now
                        </a>
                    </p>
                    <p style="color: #666; font-size: 14px;">
                        <strong>Session Date:</strong> {booking.get('booking_date')}<br>
                        <strong>Time:</strong> {booking.get('booking_time')}
                    </p>
                </body>
                </html>
                """
                
                message = Mail(
                    from_email=SENDER_EMAIL,
                    to_emails=booking['client_email'],
                    subject=f"Reminder: Complete Your Questionnaire - Session in 3 Days",
                    html_content=html_content
                )
                sg = SendGridAPIClient(SENDGRID_API_KEY)
                sg.send(message)
                
                # Mark as sent
                await db.bookings.update_one(
                    {"id": booking["id"]},
                    {"$set": {"questionnaire_reminder_sent": True}}
                )
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to send reminder for booking {booking['id']}: {e}")
    
    return {"message": f"Sent {sent_count} questionnaire reminders"}

# ==================== AUTOMATED REMINDERS MANAGEMENT ====================

@api_router.get("/admin/automated-reminders")
async def get_automated_reminders(admin=Depends(verify_token)):
    """Get all automated reminder configurations"""
    doc = await db.automated_reminders.find_one({"id": "default"}, {"_id": 0})
    return doc.get("reminders", []) if doc else []

@api_router.put("/admin/automated-reminders")
async def save_automated_reminders(data: dict, admin=Depends(verify_token)):
    """Save automated reminder configurations"""
    await db.automated_reminders.update_one(
        {"id": "default"},
        {"$set": {
            "id": "default",
            "reminders": data.get("reminders", []),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"message": "Reminders saved"}

@api_router.post("/admin/run-reminder")
async def run_reminder_manually(data: dict, admin=Depends(verify_token)):
    """Manually trigger a specific reminder"""
    reminder_id = data.get("reminder_id")
    
    doc = await db.automated_reminders.find_one({"id": "default"}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="No reminders configured")
    
    reminder = next((r for r in doc.get("reminders", []) if r.get("id") == reminder_id), None)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    sent_count = await process_reminder(reminder)
    return {"sent_count": sent_count}

@api_router.post("/cron/process-reminders")
async def cron_process_reminders():
    """Process all active reminders - call this from a daily cron job"""
    doc = await db.automated_reminders.find_one({"id": "default"}, {"_id": 0})
    if not doc:
        return {"message": "No reminders configured", "total_sent": 0}
    
    total_sent = 0
    for reminder in doc.get("reminders", []):
        if reminder.get("active", False):
            sent = await process_reminder(reminder)
            total_sent += sent
    
    return {"message": f"Processed reminders", "total_sent": total_sent}

async def process_reminder(reminder: dict) -> int:
    """Process a single reminder and send emails"""
    from datetime import timedelta
    
    if not SENDGRID_API_KEY:
        return 0
    
    trigger_type = reminder.get("trigger_type", "days_before_session")
    trigger_days = reminder.get("trigger_days", 1)
    condition = reminder.get("condition", "")
    
    # Calculate target date
    if trigger_type == "days_before_session":
        target_date = (datetime.now(timezone.utc) + timedelta(days=trigger_days)).strftime("%Y-%m-%d")
        query = {"booking_date": target_date, "status": {"$in": ["confirmed", "pending"]}}
    else:  # days_after_booking
        target_date = (datetime.now(timezone.utc) - timedelta(days=trigger_days)).strftime("%Y-%m-%d")
        query = {"created_at": {"$regex": f"^{target_date}"}, "status": {"$in": ["confirmed", "pending", "awaiting_payment"]}}
    
    # Add condition filters
    if condition == "questionnaire_incomplete":
        query["questionnaire_completed"] = {"$ne": True}
    elif condition == "payment_pending":
        query["payment_status"] = {"$in": ["pending", "", None]}
    
    # Track sent reminders to avoid duplicates
    reminder_key = f"reminder_sent_{reminder.get('id', 'unknown')}"
    query[reminder_key] = {"$ne": True}
    
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(100)
    
    sent_count = 0
    frontend_url = os.environ.get('REACT_APP_BACKEND_URL', '').replace('/api', '')
    
    for booking in bookings:
        if not booking.get("client_email"):
            continue
        
        try:
            # Replace template variables
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
            
            # Convert plain text body to HTML
            html_body = body.replace("\n", "<br>")
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                {html_body}
            </body>
            </html>
            """
            
            message = Mail(
                from_email=SENDER_EMAIL,
                to_emails=booking["client_email"],
                subject=subject,
                html_content=html_content
            )
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            sg.send(message)
            
            # Mark as sent for this reminder
            await db.bookings.update_one(
                {"id": booking["id"]},
                {"$set": {reminder_key: True}}
            )
            sent_count += 1
            
        except Exception as e:
            logger.error(f"Failed to send reminder to {booking.get('client_email')}: {e}")
    
    return sent_count

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
