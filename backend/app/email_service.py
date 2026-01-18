"""
Email Service for Invoice Sending
Handles sending invoices via email with PDF attachments
"""

import os
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from datetime import datetime
import base64
from typing import Optional, Dict, Any

# Email configuration from environment
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")  # For Gmail, use App Password
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "PersonalCFO")


def get_invoice_email_html(invoice_data: Dict[str, Any], business_info: Dict[str, Any]) -> str:
    """Generate a beautiful HTML email template for the invoice"""
    
    items_html = ""
    for item in invoice_data.get("lineItems", []):
        item_total = float(item.get("amount", 0))
        items_html += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">{item.get('description', '')}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px;">{item.get('quantity', 1)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 14px;">${float(item.get('rate', 0)):.2f}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 14px; font-weight: 600;">${item_total:.2f}</td>
        </tr>
        """
    
    due_date = invoice_data.get("dueDate", "")
    if due_date:
        try:
            if isinstance(due_date, str):
                due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00')).strftime("%B %d, %Y")
            elif isinstance(due_date, datetime):
                due_date = due_date.strftime("%B %d, %Y")
        except:
            due_date = str(due_date)
    
    client_name = invoice_data.get("clientName") or invoice_data.get("to", {}).get("name") or "Valued Customer"
    invoice_number = invoice_data.get("invoiceNumber", "")
    total_amount = float(invoice_data.get("total", 0))
    business_name = business_info.get("businessName", "Your Business")
    business_email = business_info.get("email", "")
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Invoice #{invoice_number}</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 16px;">from {business_name}</p>
            </div>
            
            <!-- Main Content -->
            <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                <!-- Greeting -->
                <p style="font-size: 16px; color: #374151; margin: 0 0 24px 0;">
                    Dear <strong>{client_name}</strong>,
                </p>
                <p style="font-size: 14px; color: #6b7280; margin: 0 0 32px 0; line-height: 1.6;">
                    Please find your invoice details below. We appreciate your business and look forward to serving you again.
                </p>
                
                <!-- Invoice Summary Box -->
                <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
                        <div>
                            <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Invoice Number</p>
                            <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #111827;">#{invoice_number}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Amount Due</p>
                            <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 700; color: #667eea;">${total_amount:.2f}</p>
                        </div>
                    </div>
                    <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
                        <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Due Date</p>
                        <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 500; color: #111827;">{due_date}</p>
                    </div>
                </div>
                
                <!-- Items Table -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                    <thead>
                        <tr style="background: #f3f4f6;">
                            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Description</th>
                            <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
                            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Rate</th>
                            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items_html}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="padding: 16px 12px; text-align: right; font-size: 16px; font-weight: 600; color: #374151;">Total Amount:</td>
                            <td style="padding: 16px 12px; text-align: right; font-size: 20px; font-weight: 700; color: #667eea;">${total_amount:.2f}</td>
                        </tr>
                    </tfoot>
                </table>
                
                <!-- Payment Info -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; text-align: center; margin-top: 32px;">
                    <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.9);">Payment is due by</p>
                    <p style="margin: 8px 0 0 0; font-size: 20px; font-weight: 700; color: white;">{due_date}</p>
                </div>
                
                <!-- Footer -->
                <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">
                        Thank you for your business!
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">
                        {business_name} • {business_email}
                    </p>
                </div>
            </div>
            
            <!-- Email Footer -->
            <div style="text-align: center; padding: 24px;">
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                    This invoice was sent via PersonalCFO
                </p>
            </div>
        </div>
    </body>
    </html>
    """


def get_invoice_email_plain(invoice_data: Dict[str, Any], business_info: Dict[str, Any]) -> str:
    """Generate plain text version of the email"""
    
    items_text = ""
    for item in invoice_data.get("lineItems", []):
        item_total = float(item.get("amount", 0))
        items_text += f"  • {item.get('description', '')} (x{item.get('quantity', 1)}) - ${item_total:.2f}\n"
    
    due_date = invoice_data.get("dueDate", "")
    if due_date:
        try:
            if isinstance(due_date, str):
                due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00')).strftime("%B %d, %Y")
            elif isinstance(due_date, datetime):
                due_date = due_date.strftime("%B %d, %Y")
        except:
            due_date = str(due_date)
    
    client_name = invoice_data.get("clientName") or invoice_data.get("to", {}).get("name") or "Valued Customer"
    invoice_number = invoice_data.get("invoiceNumber", "")
    total_amount = float(invoice_data.get("total", 0))
    business_name = business_info.get("businessName", "Your Business")
    business_email = business_info.get("email", "")
    
    return f"""
INVOICE #{invoice_number}
from {business_name}

=====================================

Dear {client_name},

Please find your invoice details below.

INVOICE DETAILS
---------------
Invoice Number: #{invoice_number}
Amount Due: ${total_amount:.2f}
Due Date: {due_date}

ITEMS
-----
{items_text}
TOTAL: ${total_amount:.2f}

=====================================

Payment is due by {due_date}

Thank you for your business!

{business_name}
{business_email}

---
This invoice was sent via PersonalCFO
    """


def send_invoice_email(
    invoice_data: Dict[str, Any],
    business_info: Dict[str, Any],
    client_email: str,
    pdf_base64: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send invoice email to client
    
    Args:
        invoice_data: Invoice data object
        business_info: Business information
        client_email: Recipient email address
        pdf_base64: Optional base64 encoded PDF attachment
    
    Returns:
        Dict with success status and message or error
    """
    try:
        # Check email configuration
        if not EMAIL_USER or not EMAIL_PASSWORD:
            return {
                "success": False,
                "error": "Email not configured. Please set EMAIL_USER and EMAIL_PASSWORD in backend/.env"
            }
        
        if not client_email:
            return {
                "success": False,
                "error": "No client email provided"
            }
        
        # Create email message
        msg = MIMEMultipart("alternative")
        invoice_number = invoice_data.get("invoiceNumber", "")
        business_name = business_info.get("businessName", "Your Business")
        
        msg["Subject"] = f"Invoice #{invoice_number} from {business_name}"
        msg["From"] = f"{EMAIL_FROM_NAME} <{EMAIL_USER}>"
        msg["To"] = client_email
        msg["Reply-To"] = business_info.get("email", EMAIL_USER)
        
        # Add plain text and HTML versions
        plain_text = get_invoice_email_plain(invoice_data, business_info)
        html_content = get_invoice_email_html(invoice_data, business_info)
        
        part1 = MIMEText(plain_text, "plain")
        part2 = MIMEText(html_content, "html")
        
        msg.attach(part1)
        msg.attach(part2)
        
        # Attach PDF if provided
        if pdf_base64:
            try:
                pdf_data = base64.b64decode(pdf_base64)
                pdf_attachment = MIMEApplication(pdf_data, _subtype="pdf")
                pdf_attachment.add_header(
                    "Content-Disposition", 
                    "attachment", 
                    filename=f"Invoice-{invoice_number}.pdf"
                )
                msg.attach(pdf_attachment)
            except Exception as e:
                print(f"Warning: Could not attach PDF: {e}")
        
        # Send email
        context = ssl.create_default_context()
        
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(EMAIL_USER, EMAIL_PASSWORD)
            server.sendmail(EMAIL_USER, client_email, msg.as_string())
        
        print(f"[SUCCESS] Invoice #{invoice_number} sent to {client_email}")
        
        return {
            "success": True,
            "message": f"Invoice sent successfully to {client_email}"
        }
        
    except smtplib.SMTPAuthenticationError:
        return {
            "success": False,
            "error": "Email authentication failed. Check your EMAIL_USER and EMAIL_PASSWORD (use App Password for Gmail)"
        }
    except smtplib.SMTPException as e:
        print(f"SMTP Error: {e}")
        return {
            "success": False,
            "error": f"Failed to send email: {str(e)}"
        }
    except Exception as e:
        print(f"Error sending invoice: {e}")
        return {
            "success": False,
            "error": str(e)
        }


def send_payment_reminder(
    invoice_data: Dict[str, Any],
    business_info: Dict[str, Any],
    client_email: str
) -> Dict[str, Any]:
    """
    Send payment reminder email for overdue invoice
    """
    try:
        if not EMAIL_USER or not EMAIL_PASSWORD:
            return {
                "success": False,
                "error": "Email not configured"
            }
        
        if not client_email:
            return {
                "success": False,
                "error": "No client email provided"
            }
        
        # Create reminder email
        msg = MIMEMultipart("alternative")
        invoice_number = invoice_data.get("invoiceNumber", "")
        
        msg["Subject"] = f"Payment Reminder: Invoice #{invoice_number}"
        msg["From"] = f"{EMAIL_FROM_NAME} <{EMAIL_USER}>"
        msg["To"] = client_email
        
        due_date = invoice_data.get("dueDate", "")
        if due_date:
            try:
                if isinstance(due_date, str):
                    due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00')).strftime("%B %d, %Y")
                elif isinstance(due_date, datetime):
                    due_date = due_date.strftime("%B %d, %Y")
            except:
                due_date = str(due_date)
        
        client_name = invoice_data.get("clientName") or invoice_data.get("to", {}).get("name") or "Customer"
        total_amount = float(invoice_data.get("total", 0))
        business_name = business_info.get("businessName", "")
        
        plain_text = f"""
Payment Reminder

Dear {client_name},

This is a friendly reminder that Invoice #{invoice_number} for ${total_amount:.2f} was due on {due_date}.

Please arrange payment at your earliest convenience.

Thank you,
{business_name}
        """
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 20px;">
            <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 24px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 20px;">⏰ Payment Reminder</h1>
                </div>
                <div style="padding: 32px;">
                    <p style="color: #374151; font-size: 14px; line-height: 1.6;">
                        Dear <strong>{client_name}</strong>,
                    </p>
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                        This is a friendly reminder that your invoice is pending payment.
                    </p>
                    <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
                        <p style="margin: 0; font-size: 12px; color: #92400e;">Invoice #{invoice_number}</p>
                        <p style="margin: 8px 0 0 0; font-size: 28px; font-weight: 700; color: #d97706;">${total_amount:.2f}</p>
                        <p style="margin: 8px 0 0 0; font-size: 14px; color: #92400e;">Due: {due_date}</p>
                    </div>
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                        Please arrange payment at your earliest convenience.
                    </p>
                    <p style="color: #374151; font-size: 14px; margin-top: 24px;">
                        Thank you,<br>
                        <strong>{business_name}</strong>
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html_content, "html"))
        
        context = ssl.create_default_context()
        
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(EMAIL_USER, EMAIL_PASSWORD)
            server.sendmail(EMAIL_USER, client_email, msg.as_string())
        
        print(f"[SUCCESS] Payment reminder sent for Invoice #{invoice_number} to {client_email}")
        
        return {
            "success": True,
            "message": "Reminder sent successfully"
        }
        
    except Exception as e:
        print(f"Error sending reminder: {e}")
        return {
            "success": False,
            "error": str(e)
        }
