from fastapi import APIRouter, HTTPException, status
from typing import List, Dict, Any
from bson import ObjectId
from datetime import datetime

from ..models import Job, JobCreate, JobUpdate, MessageResponse
from ..database import get_database

router = APIRouter(prefix="/jobs", tags=["jobs"])

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

@router.post("/", response_model=Job, status_code=status.HTTP_201_CREATED)
async def create_job(job: JobCreate):
    """Create a new job"""
    db = get_database()
    
    # Validate user ID format
    if not ObjectId.is_valid(job.userId):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Verify user exists (MongoDB will handle ObjectId conversion)
    user = db.users.find_one({"_id": ObjectId(job.userId)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
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
    # Convert userId to ObjectId
    if job_dict.get("userId"):
        job_dict["userId"] = ObjectId(job_dict["userId"])
    # Convert clientId to ObjectId if provided and not empty
    if job_dict.get("clientId") and job_dict["clientId"].strip():
        job_dict["clientId"] = ObjectId(job_dict["clientId"])
    result = db.jobs.insert_one(job_dict)
    
    # Return created job - convert ObjectId fields to strings for response
    created_job = db.jobs.find_one({"_id": result.inserted_id})
    if created_job:
        created_job = convert_objectid_to_str(created_job)
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
    
    jobs = list(db.jobs.find(query).skip(skip).limit(limit))
    # Convert ObjectId fields to strings for response
    jobs = [convert_objectid_to_str(job) for job in jobs]
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
    
    # Convert ObjectId fields to strings for response
    job = convert_objectid_to_str(job)
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
    
    # Convert userId and clientId to ObjectId if present in update data
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
    if updated_job:
        updated_job = convert_objectid_to_str(updated_job)
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

