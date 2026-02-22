from datetime import datetime
from db import logger


async def generate_contract_pdf(booking: dict, contract_template: dict) -> bytes:
    """Generate a PDF of the signed contract"""
    try:
        from weasyprint import HTML

        contract_data = booking.get("contract_data", {})
        field_responses = contract_data.get("field_responses", {})
        signature_data = contract_data.get("signature_data", "")
        signed_at = contract_data.get("signed_at", "")

        content = contract_template.get("content", "")
        smart_fields = contract_template.get("smart_fields", [])

        for field in smart_fields:
            field_id = field.get("id")
            field_type = field.get("type")
            placeholder = "{{" + field_id + "}}"

            if field_type == "agree_disagree":
                value = field_responses.get(field_id, False)
                replacement = f'<span style="font-weight: bold; color: {"green" if value else "red"};">{"&#10003; AGREED" if value else "&#10007; NOT AGREED"}</span>'
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

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Georgia', serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; color: #2D2A26; }}
                h1, h2, h3 {{ color: #2D2A26; }}
                .header {{ text-align: center; border-bottom: 2px solid #C6A87C; padding-bottom: 20px; margin-bottom: 30px; }}
                .header h1 {{ color: #C6A87C; font-size: 28px; margin: 0; }}
                .booking-info {{ background-color: #F5F2EE; padding: 15px; border-radius: 5px; margin-bottom: 20px; }}
                .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #E6E2DD; font-size: 12px; color: #8A847C; text-align: center; }}
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
            <div class="contract-content">{content}</div>
            <div class="footer">
                <p>Contract signed on: {signed_at[:10] if signed_at else 'N/A'}</p>
                <p>&copy; 2026 Silwer Lining Photography. All rights reserved.</p>
                <p>Helderkruin, Roodepoort, Johannesburg</p>
            </div>
        </body>
        </html>
        """

        pdf_bytes = HTML(string=html_content).write_pdf()
        return pdf_bytes
    except Exception as e:
        logger.error(f"Failed to generate contract PDF: {str(e)}")
        return None
