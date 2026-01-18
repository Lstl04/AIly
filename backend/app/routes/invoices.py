from fastapi import APIRouter, HTTPException, status
from typing import List, Dict, Any
from bson import ObjectId
from datetime import datetime, timezone

from ..models import Invoice, InvoiceCreate, InvoiceUpdate, MessageResponse
from ..database import get_database

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
                    db.invoices.update_one(
                        {"_id": invoice["_id"]},
                        {"$set": {"status": "overdue"}}
                    )
                    updated_count += 1
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
    
    # Validate client ID only if provided and not empty
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
        
        # Auto-link client to user if client doesn't have a userId
        if not client.get("userId"):
            db.clients.update_one(
                {"_id": ObjectId(invoice.clientId)},
                {"$set": {"userId": ObjectId(invoice.userId)}}
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
    # Convert clientId to ObjectId if provided and not empty
    if invoice_dict.get("clientId") and invoice_dict["clientId"].strip():
        invoice_dict["clientId"] = ObjectId(invoice_dict["clientId"])
    # Convert jobId to ObjectId if provided and not empty
    if invoice_dict.get("jobId") and invoice_dict["jobId"].strip():
        invoice_dict["jobId"] = ObjectId(invoice_dict["jobId"])
    result = db.invoices.insert_one(invoice_dict)
    
    # Return created invoice - convert ObjectId fields to strings for response
    created_invoice = db.invoices.find_one({"_id": result.inserted_id})
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

