from fastapi import APIRouter, HTTPException, status
from typing import List, Dict, Any
from bson import ObjectId
from datetime import datetime, timezone

from ..models import Invoice, InvoiceCreate, InvoiceUpdate, MessageResponse
from ..database import get_database
from ..email_service import send_invoice_email, send_payment_reminder

router = APIRouter(prefix="/invoices", tags=["invoices"])

def check_and_update_overdue_invoices(user_id: str = None):
    """Check for sent invoices with past due dates and update them to overdue"""
    db = get_database()
    
    # Build query for sent invoices
    query = {"status": "sent"}
    if user_id:
        # Convert user_id string to ObjectId for query
        if ObjectId.is_valid(user_id):
            query["userId"] = ObjectId(user_id)
    
    # Get all sent invoices
    sent_invoices = list(db.invoices.find(query))
    
    # Get current date (UTC)
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    updated_count = 0
    for invoice in sent_invoices:
        if invoice.get("dueDate"):
            try:
                # Parse due date
                due_date = invoice["dueDate"]
                if isinstance(due_date, str):
                    try:
                        # Try parsing ISO format with timezone
                        due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
                    except:
                        # Fallback: try parsing without timezone and add UTC
                        due_date = datetime.fromisoformat(due_date)
                        due_date = due_date.replace(tzinfo=timezone.utc)
                elif isinstance(due_date, datetime):
                    # Ensure timezone-aware
                    if due_date.tzinfo is None:
                        due_date = due_date.replace(tzinfo=timezone.utc)
                else:
                    continue  # Skip if we can't parse
                
                # Normalize to start of day for comparison
                due_date = due_date.replace(hour=0, minute=0, second=0, microsecond=0)
                
                # If due date is in the past, update status to overdue
                if due_date < today:
                    was_sent = invoice.get("status") == "sent"
                    
                    db.invoices.update_one(
                        {"_id": invoice["_id"]},
                        {"$set": {"status": "overdue"}}
                    )
                    updated_count += 1
                    
                    # Send payment reminder if invoice was just marked as overdue
                    if was_sent:
                        try:
                            # Get user (sender) details
                            user = None
                            if invoice.get("userId"):
                                user = db.users.find_one({"_id": ObjectId(invoice["userId"])})
                            
                            # Get client (recipient) details
                            client = None
                            if invoice.get("clientId"):
                                client = db.clients.find_one({"_id": ObjectId(invoice["clientId"])})
                            
                            if user and client and client.get("email"):
                                # Prepare invoice data for reminder
                                invoice_data = {
                                    "invoiceNumber": invoice.get("invoiceNumber", ""),
                                    "dueDate": invoice.get("dueDate"),
                                    "total": invoice.get("total", 0),
                                    "clientName": client.get("name", ""),
                                    "to": {
                                        "name": client.get("name", ""),
                                        "email": client.get("email", "")
                                    }
                                }
                                
                                # Prepare business info
                                business_info = {
                                    "businessName": user.get("businessName", ""),
                                    "email": user.get("businessEmail", "")
                                }
                                
                                # Send reminder email
                                reminder_result = send_payment_reminder(
                                    invoice_data=invoice_data,
                                    business_info=business_info,
                                    client_email=client.get("email")
                                )
                                
                                if not reminder_result.get("success"):
                                    print(f"[WARNING] Failed to send payment reminder: {reminder_result.get('error')}")
                        except Exception as e:
                            print(f"[ERROR] Exception while sending payment reminder: {e}")
            except Exception as e:
                # Log error but continue processing other invoices
                print(f"Error processing invoice {invoice.get('_id')} for overdue check: {e}")
                continue
    
    return updated_count

def convert_objectid_to_str(doc):
    """Convert ObjectId fields to strings for JSON serialization"""
    if doc is None:
        return None
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, dict):
                result[key] = convert_objectid_to_str(value)
            elif isinstance(value, list):
                result[key] = [convert_objectid_to_str(item) for item in value]
            else:
                result[key] = value
        return result
    return doc

@router.post("/", response_model=Invoice, status_code=status.HTTP_201_CREATED)
async def create_invoice(invoice: InvoiceCreate):
    """Create a new invoice"""
    db = get_database()
    
    # Validate user ID format
    if not ObjectId.is_valid(invoice.userId):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Validate user exists (MongoDB will handle ObjectId conversion)
    user = db.users.find_one({"_id": ObjectId(invoice.userId)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Validate and get client ID
    client_id_obj = None
    if invoice.clientId and invoice.clientId.strip():
        if not ObjectId.is_valid(invoice.clientId):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid client ID format"
            )
        
        # Verify client exists and auto-link to user if not already linked
        client = db.clients.find_one({"_id": ObjectId(invoice.clientId)})
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found"
            )
        
        client_id_obj = ObjectId(invoice.clientId)
        
        # Ensure client is linked to the invoice creator's userId
        # If client has a different userId, update it to match the invoice creator
        client_user_id = client.get("userId")
        invoice_user_id_obj = ObjectId(invoice.userId)
        
        if not client_user_id or ObjectId(client_user_id) != invoice_user_id_obj:
            db.clients.update_one(
                {"_id": ObjectId(invoice.clientId)},
                {"$set": {"userId": invoice_user_id_obj}}
            )
    
    # Auto-generate invoice number if not provided
    if not invoice.invoiceNumber:
        # Get user's last invoice number
        last_number = user.get("lastInvoiceNumber", 1000)
        invoice.invoiceNumber = f"INV-{last_number + 1}"
        
        # Update user's last invoice number
        db.users.update_one(
            {"_id": ObjectId(invoice.userId)},
            {"$set": {"lastInvoiceNumber": last_number + 1}}
        )
    
    # Insert invoice
    invoice_dict = invoice.model_dump(exclude_unset=True)
    # Convert userId to ObjectId
    if invoice_dict.get("userId"):
        invoice_dict["userId"] = ObjectId(invoice_dict["userId"])
    # Set clientId if we found one
    if client_id_obj:
        invoice_dict["clientId"] = client_id_obj
    # Convert jobId to ObjectId if provided and not empty
    if invoice_dict.get("jobId") and invoice_dict["jobId"].strip():
        invoice_dict["jobId"] = ObjectId(invoice_dict["jobId"])
    result = db.invoices.insert_one(invoice_dict)
    invoice_id_obj = result.inserted_id
    
    # Create job after invoice is created (only if we have a clientId AND no jobId was provided)
    # If a jobId was already provided, use that job instead of creating a new one
    if client_id_obj and not invoice_dict.get("jobId"):
        # Use the invoice creator's userId (not the client's userId)
        invoice_creator_user_id = ObjectId(invoice.userId)
        
        # Re-fetch client to get the client's address for job location
        # The job location should be where the work was performed (client's address)
        client_for_job = db.clients.find_one({"_id": client_id_obj})
        if not client_for_job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found when creating job"
            )
        
        # Get client's address for job location (where the work was performed)
        job_location = client_for_job.get("address") or ""
        
        # Debug: Print to verify we're using the correct address
        print(f"DEBUG: Creating job for invoice. Invoice userId: {invoice_creator_user_id}, Client ID: {client_id_obj}, Client Address: {job_location}")
        
        # Use invoice dates for job start/end times, or current time if not available
        start_time = invoice.issueDate if invoice.issueDate else datetime.utcnow()
        end_time = invoice.dueDate if invoice.dueDate else datetime.utcnow()
        
        # Create job data
        job_data = {
            "userId": ObjectId(invoice.userId),
            "clientId": client_id_obj,
            "invoiceId": ObjectId(invoice_id_obj),  # Store as ObjectId
            "title": invoice.invoiceTitle or invoice.invoiceDescription or "Invoice Job",
            "status": "completed",  # User said "done" but model uses "completed"
            "location": job_location,  # Use client's address, not user's business address
            "startTime": start_time,
            "endTime": end_time
        }
        
        # Insert job
        job_result = db.jobs.insert_one(job_data)
        job_id_obj = job_result.inserted_id
        
        # Update invoice with jobId (store as ObjectId)
        db.invoices.update_one(
            {"_id": invoice_id_obj},
            {"$set": {"jobId": ObjectId(job_id_obj)}}
        )
    
    # Return created invoice - convert ObjectId fields to strings for response
    created_invoice = db.invoices.find_one({"_id": invoice_id_obj})
    if created_invoice:
        created_invoice = convert_objectid_to_str(created_invoice)
    return created_invoice

@router.get("/", response_model=List[Invoice])
async def get_invoices(
    user_id: str = None,
    client_id: str = None,
    status_filter: str = None,
    skip: int = 0,
    limit: int = 100
):
    """Get all invoices with optional filters"""
    db = get_database()
    
    # Check and update overdue invoices before fetching
    # Only check if we're not specifically filtering for overdue (to avoid infinite loops)
    if status_filter != "overdue":
        check_and_update_overdue_invoices(user_id=user_id)
    
    query = {}
    if user_id:
        # Convert user_id string to ObjectId for query
        if ObjectId.is_valid(user_id):
            query["userId"] = ObjectId(user_id)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format"
            )
    if client_id:
        # Convert client_id string to ObjectId for query
        if ObjectId.is_valid(client_id):
            query["clientId"] = ObjectId(client_id)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid client ID format"
            )
    if status_filter:
        query["status"] = status_filter
    
    invoices = list(db.invoices.find(query).skip(skip).limit(limit))
    # Convert ObjectId fields to strings for response
    invoices = [convert_objectid_to_str(inv) for inv in invoices]
    return invoices

@router.get("/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str):
    """Get a specific invoice by ID"""
    db = get_database()
    
    if not ObjectId.is_valid(invoice_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invoice ID format"
        )
    
    invoice = db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    # Convert ObjectId fields to strings for response
    invoice = convert_objectid_to_str(invoice)
    return invoice

@router.put("/{invoice_id}", response_model=Invoice)
async def update_invoice(invoice_id: str, invoice_update: InvoiceUpdate):
    """Update an invoice"""
    db = get_database()
    
    if not ObjectId.is_valid(invoice_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invoice ID format"
        )
    
    update_data = invoice_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    # Convert userId, clientId, jobId to ObjectId if present in update data
    if update_data.get("userId"):
        if ObjectId.is_valid(update_data["userId"]):
            update_data["userId"] = ObjectId(update_data["userId"])
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format"
            )
    if update_data.get("clientId") and update_data["clientId"].strip():
        if ObjectId.is_valid(update_data["clientId"]):
            update_data["clientId"] = ObjectId(update_data["clientId"])
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid client ID format"
            )
    if update_data.get("jobId") and update_data["jobId"].strip():
        if ObjectId.is_valid(update_data["jobId"]):
            update_data["jobId"] = ObjectId(update_data["jobId"])
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid job ID format"
            )
    
    # Get invoice before update to check if status is changing to 'sent'
    invoice_before = db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice_before:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    was_draft = invoice_before.get("status") == "draft"
    is_being_sent = update_data.get("status") == "sent"
    
    result = db.invoices.update_one(
        {"_id": ObjectId(invoice_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    updated_invoice = db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if updated_invoice:
        updated_invoice = convert_objectid_to_str(updated_invoice)
    
    # Send email if status changed from draft to sent
    if was_draft and is_being_sent:
        try:
            # Get user (sender) details
            user = None
            if updated_invoice.get("userId"):
                user = db.users.find_one({"_id": ObjectId(updated_invoice["userId"])})
            
            # Get client (recipient) details
            client = None
            if updated_invoice.get("clientId"):
                client = db.clients.find_one({"_id": ObjectId(updated_invoice["clientId"])})
            
            if user and client and client.get("email"):
                # Prepare invoice data for email
                invoice_data = {
                    "invoiceNumber": updated_invoice.get("invoiceNumber", ""),
                    "dueDate": updated_invoice.get("dueDate"),
                    "lineItems": updated_invoice.get("lineItems", []),
                    "total": updated_invoice.get("total", 0),
                    "clientName": client.get("name", ""),
                    "to": {
                        "name": client.get("name", ""),
                        "email": client.get("email", ""),
                        "address": client.get("address", "")
                    }
                }
                
                # Prepare business info
                business_info = {
                    "businessName": user.get("businessName", ""),
                    "email": user.get("businessEmail", ""),
                    "phone": user.get("businessPhone", ""),
                    "address": user.get("businessAddress", "")
                }
                
                # Send email (async, don't block the response)
                email_result = send_invoice_email(
                    invoice_data=invoice_data,
                    business_info=business_info,
                    client_email=client.get("email")
                )
                
                if not email_result.get("success"):
                    print(f"[WARNING] Failed to send invoice email: {email_result.get('error')}")
                    # Don't fail the invoice update if email fails
        except Exception as e:
            print(f"[ERROR] Exception while sending invoice email: {e}")
            # Don't fail the invoice update if email fails
    
    return updated_invoice

@router.delete("/{invoice_id}", response_model=MessageResponse)
async def delete_invoice(invoice_id: str):
    """Delete an invoice"""
    db = get_database()
    
    if not ObjectId.is_valid(invoice_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invoice ID format"
        )
    
    result = db.invoices.delete_one({"_id": ObjectId(invoice_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    return {"message": f"Invoice {invoice_id} deleted successfully"}

# ===== RELATIONSHIP ENDPOINTS =====

@router.get("/{invoice_id}/details")
async def get_invoice_details(invoice_id: str):
    """Get invoice with complete context: user, client, and job information"""
    db = get_database()
    
    if not ObjectId.is_valid(invoice_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invoice ID format"
        )
    
    # Get invoice
    invoice = db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    # Convert ObjectId and datetime fields to strings for JSON serialization
    invoice = convert_objectid_to_str(invoice)
    
    # Get user details
    user_details = None
    if invoice.get("userId"):
        # MongoDB will handle ObjectId conversion
        user = db.users.find_one({"_id": ObjectId(invoice["userId"])})
        if user:
            user_details = {
                "_id": str(user["_id"]),
                "businessName": user.get("businessName"),
                "businessEmail": user.get("businessEmail"),
                "businessPhone": user.get("businessPhone"),
                "businessAddress": user.get("businessAddress"),
                "businessCategory": user.get("businessCategory"),
                "hourlyRate": user.get("hourlyRate")
            }
    
    # Get client details
    client_details = None
    if invoice.get("clientId") and invoice.get("clientId").strip():
        if ObjectId.is_valid(invoice["clientId"]):
            client = db.clients.find_one({"_id": ObjectId(invoice["clientId"])})
            if client:
                client_details = {
                    "_id": str(client["_id"]),
                    "name": client.get("name"),
                    "email": client.get("email"),
                    "address": client.get("address")
                }
    
    # Get job details if exists
    job_details = None
    if invoice.get("jobId") and invoice.get("jobId").strip():
        if ObjectId.is_valid(invoice["jobId"]):
            job = db.jobs.find_one({"_id": ObjectId(invoice["jobId"])})
            if job:
                job_details = {
                    "_id": str(job["_id"]),
                    "title": job.get("title"),
                    "status": job.get("status"),
                    "startTime": job.get("startTime"),
                    "endTime": job.get("endTime"),
                    "location": job.get("location")
                }
    
    return {
        "invoice": invoice,
        "user": user_details,
        "client": client_details,
        "job": job_details
    }

@router.get("/{invoice_id}/printable")
async def get_printable_invoice(invoice_id: str):
    """Get a fully formatted invoice ready for printing or PDF generation"""
    db = get_database()
    
    if not ObjectId.is_valid(invoice_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invoice ID format"
        )
    
    # Get invoice
    invoice = db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    # Get user (sender) details
    user = None
    if invoice.get("userId"):
        user = db.users.find_one({"_id": ObjectId(invoice["userId"])})
    
    # Get client (recipient) details
    client = None
    if invoice.get("clientId"):
        client = db.clients.find_one({"_id": ObjectId(invoice["clientId"])})
    
    # Get job details if exists
    job = None
    if invoice.get("jobId"):
        job = db.jobs.find_one({"_id": ObjectId(invoice["jobId"])})
    
    # Format for printing
    return {
        "invoiceNumber": invoice.get("invoiceNumber"),
        "issueDate": invoice.get("issueDate"),
        "dueDate": invoice.get("dueDate"),
        "status": invoice.get("status"),
        "from": {
            "businessName": user.get("businessName") if user else None,
            "email": user.get("businessEmail") if user else None,
            "phone": user.get("businessPhone") if user else None,
            "address": user.get("businessAddress") if user else None
        },
        "to": {
            "name": client.get("name") if client else None,
            "email": client.get("email") if client else None,
            "address": client.get("address") if client else None
        },
        "job": {
            "title": job.get("title") if job else None,
            "location": job.get("location") if job else None,
            "startTime": job.get("startTime") if job else None,
            "endTime": job.get("endTime") if job else None
        } if job else None,
        "lineItems": invoice.get("lineItems", []),
        "total": invoice.get("total", 0)
    }


@router.post("/{invoice_id}/send-reminder", response_model=MessageResponse)
async def send_invoice_reminder(invoice_id: str):
    """Send a payment reminder email for an overdue invoice"""
    db = get_database()
    
    if not ObjectId.is_valid(invoice_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invoice ID format"
        )
    
    # Get invoice
    invoice = db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    # Get user (sender) details
    user = None
    if invoice.get("userId"):
        user = db.users.find_one({"_id": ObjectId(invoice["userId"])})
    
    # Get client (recipient) details
    client = None
    if invoice.get("clientId"):
        client = db.clients.find_one({"_id": ObjectId(invoice["clientId"])})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found for this invoice"
        )
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found for this invoice"
        )
    
    if not client.get("email"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Client email not found. Cannot send reminder."
        )
    
    # Prepare invoice data for reminder
    invoice_data = {
        "invoiceNumber": invoice.get("invoiceNumber", ""),
        "dueDate": invoice.get("dueDate"),
        "total": invoice.get("total", 0),
        "clientName": client.get("name", ""),
        "to": {
            "name": client.get("name", ""),
            "email": client.get("email", "")
        }
    }
    
    # Prepare business info
    business_info = {
        "businessName": user.get("businessName", ""),
        "email": user.get("businessEmail", "")
    }
    
    # Send reminder email
    reminder_result = send_payment_reminder(
        invoice_data=invoice_data,
        business_info=business_info,
        client_email=client.get("email")
    )
    
    if not reminder_result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=reminder_result.get("error", "Failed to send reminder email")
        )
    
    return {"message": f"Payment reminder sent successfully to {client.get('email')}"}

