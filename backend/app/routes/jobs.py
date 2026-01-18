from fastapi import APIRouter, HTTPException, status
from typing import List, Dict, Any
from bson import ObjectId

from ..models import Job, JobCreate, JobUpdate, MessageResponse
from ..database import get_database

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.post("/", response_model=Job, status_code=status.HTTP_201_CREATED)
async def create_job(job: JobCreate):
    """Create a new job"""
    db = get_database()
    
    # Note: userId comes from Auth0 and is not an ObjectId, so we don't validate it
    # Auth0 user IDs look like: "auth0|123456" or "google-oauth2|123456"
    
    # Validate client ID only if provided (and only if it looks like an ObjectId)
    if job.clientId and ObjectId.is_valid(job.clientId):
        # Verify client exists
        client = db.clients.find_one({"_id": ObjectId(job.clientId)})
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found"
            )
    
    # Insert job
    job_dict = job.model_dump(exclude_unset=True)
    result = db.jobs.insert_one(job_dict)
    
    # Return created job
    created_job = db.jobs.find_one({"_id": result.inserted_id})
    return created_job

@router.get("/", response_model=List[Job])
async def get_jobs(
    user_id: str = None,
    client_id: str = None,
    status_filter: str = None,
    skip: int = 0,
    limit: int = 100
):
    """Get all jobs with optional filters"""
    db = get_database()
    
    query = {}
    if user_id:
        query["userId"] = user_id
    if client_id:
        query["clientId"] = client_id
    if status_filter:
        query["status"] = status_filter
    
    jobs = list(db.jobs.find(query).skip(skip).limit(limit))
    return jobs

@router.get("/{job_id}", response_model=Job)
async def get_job(job_id: str):
    """Get a specific job by ID"""
    db = get_database()
    
    if not ObjectId.is_valid(job_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format"
        )
    
    job = db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    return job

@router.put("/{job_id}", response_model=Job)
async def update_job(job_id: str, job_update: JobUpdate):
    """Update a job"""
    db = get_database()
    
    if not ObjectId.is_valid(job_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format"
        )
    
    update_data = job_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    result = db.jobs.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    updated_job = db.jobs.find_one({"_id": ObjectId(job_id)})
    return updated_job

@router.delete("/{job_id}", response_model=MessageResponse)
async def delete_job(job_id: str):
    """Delete a job"""
    db = get_database()
    
    if not ObjectId.is_valid(job_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format"
        )
    
    result = db.jobs.delete_one({"_id": ObjectId(job_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    return {"message": f"Job {job_id} deleted successfully"}

# ===== RELATIONSHIP ENDPOINTS =====

@router.get("/{job_id}/details")
async def get_job_details(job_id: str):
    """Get job with full details including client, user, and invoice information"""
    db = get_database()
    
    if not ObjectId.is_valid(job_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format"
        )
    
    # Get job
    job = db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    # Get client details
    client_details = None
    if job.get("clientId"):
        client = db.clients.find_one({"_id": ObjectId(job["clientId"])})
        if client:
            client_details = {
                "_id": str(client["_id"]),
                "name": client.get("name"),
                "email": client.get("email"),
                "address": client.get("address")
            }
    
    # Get user details
    user_details = None
    if job.get("userId"):
        user = db.users.find_one({"_id": ObjectId(job["userId"])})
        if user:
            user_details = {
                "_id": str(user["_id"]),
                "businessName": user.get("businessName"),
                "businessEmail": user.get("businessEmail"),
                "hourlyRate": user.get("hourlyRate")
            }
    
    # Get invoice details if exists
    invoice_details = None
    if job.get("invoiceId"):
        invoice = db.invoices.find_one({"_id": ObjectId(job["invoiceId"])})
        if invoice:
            invoice_details = {
                "_id": str(invoice["_id"]),
                "invoiceNumber": invoice.get("invoiceNumber"),
                "status": invoice.get("status"),
                "total": invoice.get("total"),
                "issueDate": invoice.get("issueDate"),
                "dueDate": invoice.get("dueDate")
            }
    
    return {
        "job": job,
        "client": client_details,
        "user": user_details,
        "invoice": invoice_details
    }

@router.get("/{job_id}/invoice")
async def get_job_invoice(job_id: str):
    """Get the invoice associated with a job"""
    db = get_database()
    
    if not ObjectId.is_valid(job_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format"
        )
    
    # Get job
    job = db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    # Get invoice
    if job.get("invoiceId"):
        invoice = db.invoices.find_one({"_id": ObjectId(job["invoiceId"])})
        if invoice:
            return invoice
    
    # No invoice found
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No invoice found for this job"
    )

