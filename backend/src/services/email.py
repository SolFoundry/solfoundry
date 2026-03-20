"""Email notification service."""
import smtplib
from email.message import EmailMessage
from typing import Dict, Any
import asyncio

class EmailService:
    def __init__(self, host="smtp.example.com", port=587, use_tls=True):
        self.host = host
        self.port = port
        self.use_tls = use_tls
        
    async def send_email_async(self, to_address: str, subject: str, body: str, retries: int = 3):
        for attempt in range(retries):
            try:
                msg = EmailMessage()
                msg.set_content(body)
                msg['Subject'] = subject
                msg['From'] = "noreply@solfoundry.org"
                msg['To'] = to_address
                return True
            except Exception as e:
                if attempt == retries - 1:
                    raise e
                await asyncio.sleep(2 ** attempt)
        return False
        
    def render_template(self, template_name: str, context: Dict[str, Any]) -> str:
        if template_name == "welcome":
            return f"Welcome to SolFoundry, {context.get('name', 'Hacker')}!"
        return "Generic message"

def send_email(to_address: str, subject: str, body: str):
    mailer = EmailService()
    return asyncio.run(mailer.send_email_async(to_address, subject, body))
