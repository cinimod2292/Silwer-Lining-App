from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks
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
from datetime import datetime, timezone
import jwt
import bcrypt
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

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
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@silwerlining.com')

app = FastAPI(title="Silwer Lining Photography API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class BookingCreate(BaseModel):
    client_name: str
    client_email: EmailStr
    client_phone: str
    session_type: str  # maternity, newborn, family, individual
    package_name: str
    booking_date: str
    booking_time: str
    notes: Optional[str] = ""

class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    client_email: str
    client_phone: str
    session_type: str
    package_name: str
    booking_date: str
    booking_time: str
    notes: str = ""
    status: str = "pending"  # pending, confirmed, completed, cancelled
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PortfolioCreate(BaseModel):
    title: str
    category: str  # maternity, newborn, family, individual
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

class Package(BaseModel):
    id: str
    name: str
    session_type: str
    price: int
    duration: str
    includes: List[str]
    popular: bool = False

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
                <p style="color: #8A847C; margin-top: 8px;">Capturing Life's Beautiful Moments</p>
            </div>
            
            <div style="padding: 30px 0;">
                <h2 style="color: #2D2A26; font-size: 22px;">Booking Confirmation</h2>
                <p style="color: #2D2A26; line-height: 1.8;">Dear {booking['client_name']},</p>
                <p style="color: #2D2A26; line-height: 1.8;">Thank you for booking a photography session with us! We're excited to capture your special moments.</p>
                
                <div style="background-color: #F5F2EE; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #2D2A26; margin-top: 0;">Booking Details</h3>
                    <p style="margin: 8px 0;"><strong>Session Type:</strong> {booking['session_type'].title()}</p>
                    <p style="margin: 8px 0;"><strong>Package:</strong> {booking['package_name']}</p>
                    <p style="margin: 8px 0;"><strong>Date:</strong> {booking['booking_date']}</p>
                    <p style="margin: 8px 0;"><strong>Time:</strong> {booking['booking_time']}</p>
                    {f"<p style='margin: 8px 0;'><strong>Notes:</strong> {booking['notes']}</p>" if booking.get('notes') else ""}
                </div>
                
                <p style="color: #2D2A26; line-height: 1.8;">We will contact you shortly to confirm the details and discuss any preparations for your session.</p>
                <p style="color: #2D2A26; line-height: 1.8;">If you have any questions, please don't hesitate to reach out.</p>
                
                <p style="color: #2D2A26; line-height: 1.8; margin-top: 30px;">
                    Warm regards,<br>
                    <strong>Silwer Lining Photography</strong>
                </p>
            </div>
            
            <div style="border-top: 1px solid #E6E2DD; padding-top: 20px; text-align: center; color: #8A847C; font-size: 12px;">
                <p>© 2024 Silwer Lining Photography. All rights reserved.</p>
            </div>
        </body>
        </html>
        """
        
        message = Mail(
            from_email=SENDER_EMAIL,
            to_emails=booking['client_email'],
            subject=f"Booking Confirmation - {booking['session_type'].title()} Session",
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

# Packages
@api_router.get("/packages", response_model=List[Package])
async def get_packages():
    """Get all photography packages - South African Rand (ZAR)"""
    packages = [
        # Maternity Packages
        Package(
            id="mat-essential",
            name="Essential",
            session_type="maternity",
            price=3500,
            duration="1-2 hours",
            includes=["Studio session", "10 edited digital images", "Online gallery", "2 outfit changes", "Outfits provided"],
            popular=False
        ),
        Package(
            id="mat-signature",
            name="Signature",
            session_type="maternity",
            price=5500,
            duration="2-3 hours",
            includes=["Full studio session", "25 edited digital images", "Online gallery", "4 outfit changes", "Outfits provided", "Partner included", "Hair/makeup styling guidance"],
            popular=True
        ),
        Package(
            id="mat-luxury",
            name="Luxury Collection",
            session_type="maternity",
            price=8500,
            duration="3+ hours",
            includes=["Premium studio session", "50+ edited digital images", "Online gallery", "Unlimited outfit changes", "Premium outfits provided", "Partner & siblings included", "Professional makeup included", "Fine art prints"],
            popular=False
        ),
        # Newborn Packages
        Package(
            id="new-precious",
            name="Precious Moments",
            session_type="newborn",
            price=4500,
            duration="2-3 hours",
            includes=["Baby-led studio session", "15 edited digital images", "Online gallery", "3-4 setups", "Props & wraps provided"],
            popular=False
        ),
        Package(
            id="new-complete",
            name="Complete Collection",
            session_type="newborn",
            price=7000,
            duration="3-4 hours",
            includes=["Extended baby-led session", "30 edited digital images", "Online gallery", "6+ setups", "Premium props & wraps", "Family portraits included", "Sibling shots included"],
            popular=True
        ),
        Package(
            id="new-heirloom",
            name="Heirloom",
            session_type="newborn",
            price=10000,
            duration="4+ hours",
            includes=["Full newborn experience", "50+ edited digital images", "Online gallery", "Unlimited setups", "Premium props & outfits", "Family & sibling portraits", "Fine art album", "Framed prints"],
            popular=False
        ),
        # Studio Portrait Packages
        Package(
            id="studio-mini",
            name="Mini Session",
            session_type="studio",
            price=2500,
            duration="30-45 min",
            includes=["Quick studio session", "8 edited digital images", "Online gallery", "1-2 setups", "Perfect for milestones"],
            popular=False
        ),
        Package(
            id="studio-classic",
            name="Classic",
            session_type="studio",
            price=4000,
            duration="1-1.5 hours",
            includes=["Full studio session", "20 edited digital images", "Online gallery", "3-4 setups", "Props included", "Outfit changes"],
            popular=True
        ),
        Package(
            id="studio-premium",
            name="Premium",
            session_type="studio",
            price=6500,
            duration="2+ hours",
            includes=["Extended studio session", "40 edited digital images", "Online gallery", "6+ setups", "Premium props", "Outfit guidance", "Fine art print"],
            popular=False
        ),
    ]
    return packages

# Bookings
@api_router.post("/bookings", response_model=Booking)
async def create_booking(booking_data: BookingCreate, background_tasks: BackgroundTasks):
    """Create a new booking and send confirmation email"""
    booking = Booking(**booking_data.model_dump())
    doc = booking.model_dump()
    await db.bookings.insert_one(doc)
    
    # Send confirmation email in background
    background_tasks.add_task(send_booking_confirmation_email, doc)
    
    return booking

@api_router.get("/bookings/available-times")
async def get_available_times(date: str):
    """Get available time slots for a date"""
    # Get booked times for the date
    booked = await db.bookings.find(
        {"booking_date": date, "status": {"$ne": "cancelled"}},
        {"_id": 0, "booking_time": 1}
    ).to_list(100)
    booked_times = [b["booking_time"] for b in booked]
    
    all_times = [
        "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
        "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
    ]
    available = [t for t in all_times if t not in booked_times]
    return {"date": date, "available_times": available}

# Portfolio (Public)
@api_router.get("/portfolio", response_model=List[Portfolio])
async def get_portfolio(category: Optional[str] = None, featured_only: bool = False):
    """Get portfolio images, optionally filtered by category"""
    query = {}
    if category:
        query["category"] = category
    if featured_only:
        query["featured"] = True
    
    items = await db.portfolio.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    return items

# Testimonials (Public - approved only)
@api_router.get("/testimonials", response_model=List[Testimonial])
async def get_testimonials():
    """Get approved testimonials"""
    items = await db.testimonials.find({"approved": True}, {"_id": 0}).to_list(50)
    return items

# Contact
@api_router.post("/contact", response_model=ContactMessage)
async def submit_contact(data: ContactMessageCreate):
    """Submit a contact message"""
    message = ContactMessage(**data.model_dump())
    doc = message.model_dump()
    await db.contact_messages.insert_one(doc)
    return message

# ==================== ADMIN ROUTES ====================

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

# Admin - Bookings
@api_router.get("/admin/bookings", response_model=List[Booking])
async def admin_get_bookings(admin=Depends(verify_token)):
    """Get all bookings (admin only)"""
    bookings = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return bookings

@api_router.put("/admin/bookings/{booking_id}")
async def admin_update_booking(booking_id: str, status: str, admin=Depends(verify_token)):
    """Update booking status"""
    result = await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": status}}
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

# Admin - Portfolio
@api_router.get("/admin/portfolio", response_model=List[Portfolio])
async def admin_get_portfolio(admin=Depends(verify_token)):
    """Get all portfolio items (admin only)"""
    items = await db.portfolio.find({}, {"_id": 0}).sort("order", 1).to_list(200)
    return items

@api_router.post("/admin/portfolio", response_model=Portfolio)
async def admin_create_portfolio(data: PortfolioCreate, admin=Depends(verify_token)):
    """Create a portfolio item"""
    # Get max order
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

# Admin - Testimonials
@api_router.get("/admin/testimonials", response_model=List[Testimonial])
async def admin_get_testimonials(admin=Depends(verify_token)):
    """Get all testimonials (admin only)"""
    items = await db.testimonials.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

@api_router.post("/admin/testimonials", response_model=Testimonial)
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

# Admin - Contact Messages
@api_router.get("/admin/messages", response_model=List[ContactMessage])
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

# Admin - Dashboard Stats
@api_router.get("/admin/stats")
async def admin_get_stats(admin=Depends(verify_token)):
    """Get dashboard statistics"""
    total_bookings = await db.bookings.count_documents({})
    pending_bookings = await db.bookings.count_documents({"status": "pending"})
    confirmed_bookings = await db.bookings.count_documents({"status": "confirmed"})
    portfolio_count = await db.portfolio.count_documents({})
    testimonials_count = await db.testimonials.count_documents({"approved": True})
    unread_messages = await db.contact_messages.count_documents({"read": False})
    
    return {
        "total_bookings": total_bookings,
        "pending_bookings": pending_bookings,
        "confirmed_bookings": confirmed_bookings,
        "portfolio_count": portfolio_count,
        "testimonials_count": testimonials_count,
        "unread_messages": unread_messages
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
