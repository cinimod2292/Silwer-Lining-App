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
    available_days: List[int] = [1, 2, 3, 4, 5]  # 0=Sun, 1=Mon, ..., 6=Sat
    time_slots: List[str] = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]
    buffer_minutes: int = 30  # Buffer between sessions
    min_lead_days: int = 3  # Minimum days before booking
    max_advance_days: int = 90  # Maximum days in advance
    blocked_dates: List[str] = []  # Specific dates blocked
    weekend_surcharge: int = 500  # R500 for weekends
    session_duration_default: int = 120  # Default 2 hours

class BookingSettings(BaseModel):
    id: str = "default"
    available_days: List[int] = [1, 2, 3, 4, 5]
    time_slots: List[str] = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]
    buffer_minutes: int = 30
    min_lead_days: int = 3
    max_advance_days: int = 90
    blocked_dates: List[str] = []
    weekend_surcharge: int = 500
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
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CalendarSettings(BaseModel):
    apple_calendar_url: str = ""
    apple_calendar_user: str = ""
    apple_calendar_password: str = ""
    sync_enabled: bool = False

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
async def get_available_times(date: str):
    """Get available time slots for a date"""
    # Get booking settings
    settings = await db.booking_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        settings = BookingSettings().model_dump()
    
    # Check if date is blocked
    if date in settings.get("blocked_dates", []):
        return {"date": date, "available_times": [], "message": "This date is not available"}
    
    # Check day of week
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
        day_of_week = date_obj.weekday()  # 0=Monday, 6=Sunday
        # Convert to our format (0=Sunday, 1=Monday, etc.)
        day_of_week = (day_of_week + 1) % 7
        
        if day_of_week not in settings.get("available_days", [1, 2, 3, 4, 5]):
            is_weekend = day_of_week in [0, 6]
            if is_weekend:
                return {"date": date, "available_times": settings.get("time_slots", []), "is_weekend": True, "weekend_surcharge": settings.get("weekend_surcharge", 500)}
            return {"date": date, "available_times": [], "message": "Not available on this day"}
    except ValueError:
        pass
    
    # Get booked times for the date
    booked = await db.bookings.find(
        {"booking_date": date, "status": {"$nin": ["cancelled"]}},
        {"_id": 0, "booking_time": 1}
    ).to_list(100)
    booked_times = [b["booking_time"] for b in booked]
    
    all_times = settings.get("time_slots", ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"])
    available = [t for t in all_times if t not in booked_times]
    
    return {"date": date, "available_times": available}

# ==================== BOOKINGS (Public Create) ====================

@api_router.post("/bookings")
async def create_booking(booking_data: BookingCreate, background_tasks: BackgroundTasks):
    """Create a new booking and send confirmation email"""
    booking = Booking(**booking_data.model_dump())
    doc = booking.model_dump()
    await db.bookings.insert_one(doc)
    
    # Send confirmation email in background
    background_tasks.add_task(send_booking_confirmation_email, doc)
    
    return booking

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

# ==================== ADMIN - CALENDAR ====================

@api_router.get("/admin/calendar-settings")
async def admin_get_calendar_settings(admin=Depends(verify_token)):
    """Get calendar sync settings"""
    settings = await db.calendar_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        settings = {
            "id": "default",
            "apple_calendar_url": "",
            "apple_calendar_user": "",
            "sync_enabled": False
        }
    # Don't return the password
    settings.pop("apple_calendar_password", None)
    return settings

@api_router.put("/admin/calendar-settings")
async def admin_update_calendar_settings(data: CalendarSettings, admin=Depends(verify_token)):
    """Update calendar sync settings"""
    update_data = {
        "id": "default",
        "apple_calendar_url": data.apple_calendar_url,
        "apple_calendar_user": data.apple_calendar_user,
        "sync_enabled": data.sync_enabled
    }
    
    # Only update password if provided
    if data.apple_calendar_password:
        update_data["apple_calendar_password"] = data.apple_calendar_password
    
    await db.calendar_settings.update_one(
        {"id": "default"},
        {"$set": update_data},
        upsert=True
    )
    return {"message": "Calendar settings updated"}

@api_router.post("/admin/calendar/sync")
async def admin_sync_calendar(admin=Depends(verify_token)):
    """Manually trigger calendar sync"""
    settings = await db.calendar_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings or not settings.get("sync_enabled"):
        raise HTTPException(status_code=400, detail="Calendar sync not enabled")
    
    # TODO: Implement CalDAV sync when credentials are provided
    return {"message": "Calendar sync triggered", "status": "pending_implementation"}

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
