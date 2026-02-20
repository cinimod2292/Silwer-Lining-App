from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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
from sendgrid.helpers.mail import Mail
import httpx
import caldav
from icalendar import Calendar as ICalendar, Event as ICalEvent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
    status: str = "pending"  # pending, confirmed, completed, cancelled, rescheduled
    calendar_event_id: Optional[str] = None
    # Add-ons and pricing
    selected_addons: List[str] = []
    addons_total: int = 0
    is_weekend: bool = False
    weekend_surcharge: int = 0
    total_price: int = 0
    # Questionnaire responses
    questionnaire_responses: dict = {}  # {question_id: answer}
    # Contract data
    contract_signed: bool = False
    contract_data: dict = {}  # {field_responses, signature_data, signed_at}
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
        
        html_content = f"""
        <html>
        <body style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FDFCF8;">
            <div style="text-align: center; padding: 30px 0; border-bottom: 2px solid #C6A87C;">
                <h1 style="color: #2D2A26; font-size: 28px; margin: 0;">Silwer Lining Photography</h1>
                <p style="color: #8A847C; margin-top: 8px;">More than photos — capturing the glow, the love and the memory</p>
            </div>
            
            <div style="padding: 30px 0;">
                <h2 style="color: #2D2A26; font-size: 22px;">Booking Request Received</h2>
                <p style="color: #2D2A26; line-height: 1.8;">Dear {booking['client_name']},</p>
                <p style="color: #2D2A26; line-height: 1.8;">Thank you for your booking request! We're excited to capture your special moments.</p>
                
                <div style="background-color: #F5F2EE; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #2D2A26; margin-top: 0;">Booking Details</h3>
                    <p style="margin: 8px 0;"><strong>Session Type:</strong> {booking['session_type'].title()}</p>
                    <p style="margin: 8px 0;"><strong>Package:</strong> {booking['package_name']}</p>
                    <p style="margin: 8px 0;"><strong>Price:</strong> R{booking.get('package_price', 0):,}</p>
                    <p style="margin: 8px 0;"><strong>Requested Date:</strong> {booking['booking_date']}</p>
                    <p style="margin: 8px 0;"><strong>Requested Time:</strong> {booking['booking_time']}</p>
                    {f"<p style='margin: 8px 0;'><strong>Notes:</strong> {booking['notes']}</p>" if booking.get('notes') else ""}
                </div>
                
                <p style="color: #2D2A26; line-height: 1.8;"><strong>Next Steps:</strong></p>
                <p style="color: #2D2A26; line-height: 1.8;">We will contact you shortly to confirm availability and send your invoice. Remember, a 50% deposit is required to secure your booking.</p>
                
                <p style="color: #2D2A26; line-height: 1.8; margin-top: 20px;">
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
            subject=f"Booking Request - {booking['session_type'].title()} Session",
            html_content=html_content
        )
        
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        logger.info(f"Email sent to {booking['client_email']}, status: {response.status_code}")
        return response.status_code == 202
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
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
    
    return booking

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
