from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone


class PackageCreate(BaseModel):
    name: str
    session_type: str
    price: float
    duration: str = ""
    includes: List[str] = []
    popular: bool = False
    active: bool = True
    description: str = ""
    image_url: str = ""

class Package(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    session_type: str
    price: float
    duration: str = ""
    includes: List[str] = []
    popular: bool = False
    active: bool = True
    description: str = ""
    image_url: str = ""
    order: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BookingSettingsUpdate(BaseModel):
    id: str = "default"
    time_slots: List[str] = []
    available_days: List[int] = [1, 2, 3, 4, 5]
    blocked_dates: List[str] = []
    max_bookings_per_slot: int = 1
    advance_booking_days: int = 90
    min_advance_hours: int = 24
    weekend_surcharge: int = 750
    time_slot_schedule: dict = {}

class BookingSettings(BaseModel):
    id: str = "default"
    time_slots: List[str] = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]
    available_days: List[int] = [1, 2, 3, 4, 5]
    blocked_dates: List[str] = []
    max_bookings_per_slot: int = 1
    advance_booking_days: int = 90
    min_advance_hours: int = 24
    weekend_surcharge: int = 750
    time_slot_schedule: dict = {}

class BookingCreate(BaseModel):
    client_name: str
    client_email: str
    client_phone: str
    session_type: str
    package_id: str
    package_name: str
    package_price: float
    booking_date: str
    booking_time: str
    notes: str = ""
    selected_addons: list = []
    addons_total: float = 0
    total_price: float = 0
    is_weekend: bool = False
    weekend_surcharge: float = 0
    contract_signed: bool = False
    contract_data: dict = {}
    questionnaire_responses: dict = {}
    payment_method: str = ""
    payment_type: str = ""

class PaymentSettings(BaseModel):
    id: str = "default"
    bank_name: str = ""
    account_holder: str = ""
    account_number: str = ""
    branch_code: str = ""
    account_type: str = ""
    reference_format: str = "BOOKING-{booking_id}"
    payfast_enabled: bool = True
    payfast_sandbox: bool = True
    payfast_merchant_id: str = ""
    payfast_merchant_key: str = ""
    payfast_passphrase: str = ""
    payfast_sandbox_merchant_id: str = ""
    payfast_sandbox_merchant_key: str = ""
    payfast_sandbox_passphrase: str = ""
    payflex_enabled: bool = False
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BookingUpdate(BaseModel):
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    session_type: Optional[str] = None
    package_id: Optional[str] = None
    package_name: Optional[str] = None
    package_price: Optional[float] = None
    booking_date: Optional[str] = None
    booking_time: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    payment_status: Optional[str] = None

class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    client_email: str
    client_phone: str
    session_type: str
    package_id: str
    package_name: str
    package_price: float
    booking_date: str
    booking_time: str
    notes: str = ""
    selected_addons: List[dict] = []
    addons_total: float = 0
    total_price: float = 0
    weekend_surcharge: float = 0
    status: str = "pending"
    payment_status: str = ""
    payment_method: str = ""
    payment_type: str = ""
    amount_paid: float = 0
    contract_signed: bool = False
    contract_data: dict = {}
    questionnaire_responses: dict = {}
    questionnaire_completed: bool = False
    manage_token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CalendarSettings(BaseModel):
    id: str = "default"
    apple_calendar_url: str = ""
    apple_calendar_user: str = ""
    apple_calendar_password: str = ""
    sync_enabled: bool = False
    booking_calendar: str = ""

class ManualBookingCreate(BaseModel):
    client_name: str
    client_email: str
    client_phone: str = ""
    session_type: str
    booking_date: str
    booking_time: str
    notes: str = ""

class ManualBookingToken(BaseModel):
    token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    booking_id: str
    expires_at: str
    used: bool = False

class BlockedSlot(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    time: str
    reason: str = "Blocked by admin"

class CustomSlot(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    time: str
    session_type: str = ""

class ContractSmartField(BaseModel):
    id: str
    type: str
    label: str
    required: bool = True
    options: List[str] = []

class ContractTemplate(BaseModel):
    id: str = "default"
    title: str = "Photography Session Contract"
    content: str = ""
    smart_fields: List[ContractSmartField] = []
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SignedContractData(BaseModel):
    field_responses: dict = {}
    signature_data: str = ""
    signed_at: str = ""
    client_name: str = ""
    ip_address: str = ""
    user_agent: str = ""

class AddOnCreate(BaseModel):
    name: str
    description: str = ""
    price: float
    categories: List[str] = []
    active: bool = True

class AddOn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    price: float
    categories: List[str] = []
    active: bool = True
    order: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class EmailTemplateCreate(BaseModel):
    name: str
    subject: str
    body: str
    variables: List[str] = []
    active: bool = True

class EmailTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    display_name: str = ""
    subject: str
    body: str
    variables: List[str] = []
    active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = ""

class StorageSettingsUpdate(BaseModel):
    id: str = "default"
    provider: str = "cloudflare_r2"
    account_id: str = ""
    access_key_id: str = ""
    secret_access_key: str = ""
    bucket_name: str = ""
    public_url: str = ""

class InstagramSettingsUpdate(BaseModel):
    id: str = "default"
    access_token: str = ""
    enabled: bool = True
    post_count: int = 6

class QuestionOption(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    value: str = ""

class Question(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    type: str = "text"
    required: bool = True
    options: List[QuestionOption] = []
    placeholder: str = ""
    help_text: str = ""
    max_length: int = 0
    order: int = 0

class QuestionnaireCreate(BaseModel):
    session_type: str
    title: str
    description: str = ""
    questions: List[Question] = []
    active: bool = True

class Questionnaire(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_type: str
    title: str
    description: str = ""
    questions: List[Question] = []
    active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PortfolioCreate(BaseModel):
    title: str = ""
    category: str = "maternity"
    image_url: str = ""
    description: str = ""
    featured: bool = False

class Portfolio(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    category: str = "maternity"
    image_url: str = ""
    description: str = ""
    featured: bool = False
    order: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class TestimonialCreate(BaseModel):
    client_name: str
    content: str
    session_type: str = ""
    rating: int = 5

class Testimonial(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    content: str
    session_type: str = ""
    rating: int = 5
    approved: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class FAQCreate(BaseModel):
    question: str
    answer: str
    category: str = "general"
    active: bool = True
    order: int = 0

class FAQ(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question: str
    answer: str
    category: str = "general"
    active: bool = True
    order: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ContactMessageCreate(BaseModel):
    name: str
    email: str
    phone: str = ""
    message: str

class ContactMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str = ""
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
