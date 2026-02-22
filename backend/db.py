from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
import os
import logging

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

# PayFast Config (fallback, DB credentials preferred)
PAYFAST_MERCHANT_ID = os.environ.get('PAYFAST_MERCHANT_ID', '')
PAYFAST_MERCHANT_KEY = os.environ.get('PAYFAST_MERCHANT_KEY', '')
PAYFAST_PASSPHRASE = os.environ.get('PAYFAST_PASSPHRASE', '')
PAYFAST_SANDBOX = os.environ.get('PAYFAST_SANDBOX', 'true').lower() == 'true'
PAYFAST_URL = "https://sandbox.payfast.co.za/eng/process" if PAYFAST_SANDBOX else "https://www.payfast.co.za/eng/process"

# Apple Calendar Config
APPLE_CALENDAR_URL = os.environ.get('APPLE_CALENDAR_URL', '')
APPLE_CALENDAR_USER = os.environ.get('APPLE_CALENDAR_USER', '')
APPLE_CALENDAR_PASSWORD = os.environ.get('APPLE_CALENDAR_PASSWORD', '')

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
