from fastapi import APIRouter, HTTPException, status
from typing import List, Dict, Any
from bson import ObjectId

from ..models import Invoice, InvoiceCreate, InvoiceUpdate, MessageResponse
from ..database import get_database

router = APIRouter(prefix="/invoices", tags=["invoices"])

@router.post("/", response_model=Invoice, status_code=status.HTTP_201_CREATED)
async def create_invoice(invoice: InvoiceCreate):
    """Create a new invoice"""
    db = get_database()
    
    # Validate IDs
    if not ObjectId.is_valid(invoice.userId):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
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
            {"$set": {"userId": invoice.userId}}
        )
    
    # Auto-generate invoice number if not provided
    if not invoice.invoiceNumber:
        # Get user's last invoice number
        user = db.users.find_one({"_id": ObjectId(invoice.userId)})
        if user:
            last_number = user.get("lastInvoiceNumber", 1000)
            invoice.invoiceNumber = f"INV-{last_number + 1}"
            
            # Update user's last invoice number
            db.users.update_one(
                {"_id": ObjectId(invoice.userId)},
                {"$set": {"lastInvoiceNumber": last_number + 1}}
            )
    
    # Insert invoice
    invoice_dict = invoice.model_dump(exclude_unset=True)
    result = db.invoices.insert_one(invoice_dict)
    
    # Return created invoice
    created_invoice = db.invoices.find_one({"_id": result.inserted_id})
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
    
    query = {}
    if user_id:
        query["userId"] = user_id
    if client_id:
        query["clientId"] = client_id
    if status_filter:
        query["status"] = status_filter
    
    invoices = list(db.invoices.find(query).skip(skip).limit(limit))
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
    
    # Get user details
    user_details = None
    if invoice.get("userId"):
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
    if invoice.get("clientId"):
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
    if invoice.get("jobId"):
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

