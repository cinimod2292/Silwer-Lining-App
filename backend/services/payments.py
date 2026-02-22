import hashlib
import urllib.parse
from db import db, PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY, PAYFAST_PASSPHRASE, PAYFAST_SANDBOX, PAYFAST_URL, logger


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
                "merchant_id": merchant_id, "merchant_key": merchant_key,
                "passphrase": passphrase, "is_sandbox": is_sandbox, "url": url
            }
    except Exception as e:
        logger.error(f"Error getting PayFast credentials: {e}")

    return {
        "merchant_id": PAYFAST_MERCHANT_ID, "merchant_key": PAYFAST_MERCHANT_KEY,
        "passphrase": PAYFAST_PASSPHRASE, "is_sandbox": PAYFAST_SANDBOX, "url": PAYFAST_URL
    }


def calculate_payfast_signature(data: dict) -> str:
    """Calculate MD5 signature for PayFast (using env vars - legacy)"""
    return calculate_payfast_signature_with_creds(data, PAYFAST_PASSPHRASE)


def calculate_payfast_signature_with_creds(data: dict, passphrase: str = "") -> str:
    """Calculate MD5 signature for PayFast with custom passphrase"""
    field_order = [
        "merchant_id", "merchant_key", "return_url", "cancel_url", "notify_url",
        "name_first", "name_last", "email_address", "cell_number",
        "m_payment_id", "amount", "item_name", "item_description",
        "custom_str1", "custom_str2", "custom_str3", "custom_str4", "custom_str5",
        "custom_int1", "custom_int2", "custom_int3", "custom_int4", "custom_int5",
        "email_confirmation", "confirmation_address", "payment_method"
    ]
    params = []
    for field in field_order:
        if field in data and data[field] is not None and str(data[field]).strip() != "":
            value = str(data[field]).strip()
            encoded_value = urllib.parse.quote_plus(value)
            params.append(f"{field}={encoded_value}")

    pf_string = "&".join(params)
    passphrase_clean = passphrase.strip() if passphrase else ""
    if passphrase_clean:
        pf_string += f"&passphrase={urllib.parse.quote_plus(passphrase_clean)}"
    return hashlib.md5(pf_string.encode()).hexdigest()


async def verify_payfast_signature_async(data: dict, signature: str) -> bool:
    """Verify ITN signature from PayFast using database credentials"""
    pf_creds = await get_payfast_credentials()
    params = []
    for key, value in data.items():
        if key != "signature" and value is not None and str(value).strip() != "":
            encoded_value = urllib.parse.quote_plus(str(value).strip())
            params.append(f"{key}={encoded_value}")

    pf_string = "&".join(params)
    passphrase = pf_creds["passphrase"].strip() if pf_creds["passphrase"] else ""
    if passphrase:
        pf_string += f"&passphrase={urllib.parse.quote_plus(passphrase)}"
    calculated = hashlib.md5(pf_string.encode()).hexdigest()
    logger.info(f"ITN Signature verification - Received: {signature}, Calculated: {calculated}")
    return calculated.lower() == signature.lower()


def verify_payfast_signature(data: dict, signature: str) -> bool:
    """Verify ITN signature from PayFast (sync version using env vars)"""
    params = []
    for key, value in data.items():
        if key != "signature" and value is not None and str(value).strip() != "":
            encoded_value = urllib.parse.quote_plus(str(value).strip())
            params.append(f"{key}={encoded_value}")

    pf_string = "&".join(params)
    passphrase = PAYFAST_PASSPHRASE.strip() if PAYFAST_PASSPHRASE else ""
    if passphrase:
        pf_string += f"&passphrase={urllib.parse.quote_plus(passphrase)}"
    calculated = hashlib.md5(pf_string.encode()).hexdigest()
    logger.info(f"ITN Signature verification - Received: {signature}, Calculated: {calculated}")
    return calculated.lower() == signature.lower()
