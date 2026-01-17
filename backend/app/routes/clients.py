from fastapi import APIRouter, HTTPException, status
from typing import List, Dict, Any
from bson import ObjectId

from ..models import Client, ClientCreate, ClientUpdate, MessageResponse
from ..database import get_database

router = APIRouter(prefix="/clients", tags=["clients"])

@router.post("/", response_model=Client, status_code=status.HTTP_201_CREATED)
async def create_client(client: ClientCreate):
    """Create a new client"""
    db = get_database()
    
    # Verify user exists
    if not ObjectId.is_valid(client.userId):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Insert client
    client_dict = client.model_dump(exclude_unset=True)
    result = db.clients.insert_one(client_dict)
    
    # Return created client
    created_client = db.clients.find_one({"_id": result.inserted_id})
    return created_client

@router.get("/", response_model=List[Client])
async def get_clients(user_id: str = None, skip: int = 0, limit: int = 100):
    """Get all clients, optionally filtered by user_id"""
    db = get_database()
    
    query = {}
    if user_id:
        query["userId"] = user_id
    
    clients = list(db.clients.find(query).skip(skip).limit(limit))
    return clients

@router.get("/{client_id}", response_model=Client)
async def get_client(client_id: str):
    """Get a specific client by ID"""
    db = get_database()
    
    if not ObjectId.is_valid(client_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid client ID format"
        )
    
    client = db.clients.find_one({"_id": ObjectId(client_id)})
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    return client

@router.put("/{client_id}", response_model=Client)
async def update_client(client_id: str, client_update: ClientUpdate):
    """Update a client"""
    db = get_database()
    
    if not ObjectId.is_valid(client_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid client ID format"
        )
    
    update_data = client_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    result = db.clients.update_one(
        {"_id": ObjectId(client_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    updated_client = db.clients.find_one({"_id": ObjectId(client_id)})
    return updated_client

@router.delete("/{client_id}", response_model=MessageResponse)
async def delete_client(client_id: str):
    """Delete a client"""
    db = get_database()
    
    if not ObjectId.is_valid(client_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid client ID format"
        )
    
    result = db.clients.delete_one({"_id": ObjectId(client_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    return {"message": f"Client {client_id} deleted successfully"}

# ===== RELATIONSHIP ENDPOINTS =====

@router.get("/{client_id}/jobs", response_model=List[Dict[str, Any]])
async def get_client_jobs(client_id: str, status_filter: str = None):
    """Get all jobs for a specific client"""
    db = get_database()
    
    if not ObjectId.is_valid(client_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid client ID format"
        )
    
    # Verify client exists
    client = db.clients.find_one({"_id": ObjectId(client_id)})
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    # Build query
    query = {"clientId": client_id}
    if status_filter:
        query["status"] = status_filter
    
    # Get jobs
    jobs = list(db.jobs.find(query))
    
    # Add invoice info if exists
    for job in jobs:
        if job.get("invoiceId"):
            invoice = db.invoices.find_one({"_id": ObjectId(job["invoiceId"])})
            if invoice:
                job["invoiceNumber"] = invoice.get("invoiceNumber")
                job["invoiceStatus"] = invoice.get("status")
    
    return jobs

@router.get("/{client_id}/invoices", response_model=List[Dict[str, Any]])
async def get_client_invoices(client_id: str, status_filter: str = None):
    """Get all invoices for a specific client"""
    db = get_database()
    
    if not ObjectId.is_valid(client_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid client ID format"
        )
    
    # Verify client exists
    client = db.clients.find_one({"_id": ObjectId(client_id)})
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    # Build query
    query = {"clientId": client_id}
    if status_filter:
        query["status"] = status_filter
    
    # Get invoices and add job info
    invoices = list(db.invoices.find(query))
    
    for invoice in invoices:
        if invoice.get("jobId"):
            job = db.jobs.find_one({"_id": ObjectId(invoice["jobId"])})
            if job:
                invoice["jobTitle"] = job.get("title")
                invoice["jobLocation"] = job.get("location")
    
    return invoices

@router.get("/{client_id}/summary")
async def get_client_summary(client_id: str):
    """Get a summary of client's data including job and invoice counts"""
    db = get_database()
    
    if not ObjectId.is_valid(client_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid client ID format"
        )
    
    # Get client
    client = db.clients.find_one({"_id": ObjectId(client_id)})
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )
    
    # Get user info
    user_info = None
    if client.get("userId"):
        user = db.users.find_one({"_id": ObjectId(client["userId"])})
        if user:
            user_info = {
                "businessName": user.get("businessName"),
                "businessEmail": user.get("businessEmail")
            }
    
    # Count related documents
    job_count = db.jobs.count_documents({"clientId": client_id})
    invoice_count = db.invoices.count_documents({"clientId": client_id})
    
    # Get job status breakdown
    jobs_pending = db.jobs.count_documents({"clientId": client_id, "status": "pending"})
    jobs_in_progress = db.jobs.count_documents({"clientId": client_id, "status": "in_progress"})
    jobs_completed = db.jobs.count_documents({"clientId": client_id, "status": "completed"})
    
    # Calculate total billed
    client_invoices = list(db.invoices.find({"clientId": client_id}))
    total_billed = sum(inv.get("total", 0) for inv in client_invoices)
    total_paid = sum(inv.get("total", 0) for inv in client_invoices if inv.get("status") == "paid")
    total_outstanding = sum(inv.get("total", 0) for inv in client_invoices if inv.get("status") in ["sent", "overdue"])
    
    return {
        "client": {
            "_id": str(client["_id"]),
            "name": client.get("name"),
            "email": client.get("email"),
            "address": client.get("address")
        },
        "user": user_info,
        "counts": {
            "jobs": job_count,
            "invoices": invoice_count
        },
        "jobs": {
            "pending": jobs_pending,
            "inProgress": jobs_in_progress,
            "completed": jobs_completed
        },
        "financials": {
            "totalBilled": total_billed,
            "totalPaid": total_paid,
            "outstanding": total_outstanding
        }
    }

