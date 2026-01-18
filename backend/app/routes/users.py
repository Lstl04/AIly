from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Dict, Any
from bson import ObjectId
from datetime import datetime

from ..models import User, UserCreate, UserUpdate, MessageResponse
from ..database import get_database
from ..api.dependencies import verify_token

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/sync")
async def sync_user(token: dict = Depends(verify_token)):
    db = get_database()

    auth0_id = token.get("sub")
    users_collection = db.users
    
    existing_user = users_collection.find_one({"auth0_id": auth0_id})

    # Case 1: User doesn't exist at all -> Create them, but mark as incomplete
    if not existing_user:
        new_user = {
            "auth0_id": auth0_id,
            "onboarding_complete": False  # <--- THE FLAG
        }
        result = users_collection.insert_one(new_user)
        return {"status": "created", "onboarding_complete": False}

    # Case 2: User exists, but hasn't finished the form
    if not existing_user.get("onboarding_complete"):
        return {"status": "exists", "onboarding_complete": False}

    # Case 3: Fully active user
    return {"status": "exists", "onboarding_complete": True}

@router.get("/profile")
async def get_profile(token: dict = Depends(verify_token)):
    """Get the current user's profile"""
    db = get_database()

    auth0_id = token.get("sub")
    users_collection = db.users
    
    user = users_collection.find_one({"auth0_id": auth0_id})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Convert ObjectId to string for JSON serialization
    user["_id"] = str(user["_id"])
    
    return user

@router.put("/profile")
def update_profile(profile: User, token: dict = Depends(verify_token)):
    db = get_database()

    auth0_id = token.get("sub")
    users_collection = db.users
    
    # Update the document for this specific user
    result = users_collection.update_one(
        {"auth0_id": auth0_id},
        {"$set": {
            "businessName": profile.businessName,
            "businessPhone": profile.businessPhone,
            "businessEmail": profile.businessEmail,
            "businessAddress": profile.businessAddress,
            "businessCategory": profile.businessCategory,
            "hourlyRate": profile.hourlyRate,
            "firstName": profile.firstName,
            "lastName": profile.lastName,
            "personalEmail": profile.personalEmail,
            "onboarding_complete": True 
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"msg": "Profile updated successfully"}

@router.post("/", response_model=User, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate):
    """Create a new user"""
    db = get_database()
    
    # Check if user with email already exists
    existing_user = db.users.find_one({"auth0_id": user.auth0Id})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    # Create user document
    user_dict = user.model_dump(exclude_unset=True)
    user_dict["createdAt"] = datetime.utcnow()
    
    # Insert into database
    result = db.users.insert_one(user_dict)
    
    # Retrieve and return created user
    created_user = db.users.find_one({"_id": result.inserted_id})
    return created_user

@router.get("/", response_model=List[User])
async def get_users(skip: int = 0, limit: int = 100):
    """Get all users with pagination"""
    db = get_database()
    users = list(db.users.find().skip(skip).limit(limit))
    return users

@router.get("/by-auth0/{auth0_id:path}", response_model=User)
async def get_user_by_auth0(auth0_id: str):
    """Get a user by their Auth0 ID (sub claim)"""
    db = get_database()
    
    user = db.users.find_one({"auth0_id": auth0_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user

@router.get("/{user_id}", response_model=User)
async def get_user(user_id: str):
    """Get a specific user by ID"""
    db = get_database()
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user

@router.put("/{user_id}", response_model=User)
async def update_user(user_id: str, user_update: UserUpdate):
    """Update a user"""
    db = get_database()
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Get update data (exclude unset fields)
    update_data = user_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    # Update user
    result = db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Return updated user
    updated_user = db.users.find_one({"_id": ObjectId(user_id)})
    return updated_user

@router.delete("/{user_id}", response_model=MessageResponse)
async def delete_user(user_id: str):
    """Delete a user"""
    db = get_database()
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    result = db.users.delete_one({"_id": ObjectId(user_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {"message": f"User {user_id} deleted successfully"}

# ===== RELATIONSHIP ENDPOINTS =====

@router.get("/{user_id}/clients", response_model=List[Dict[str, Any]])
async def get_user_clients(user_id: str):
    """Get all clients for a specific user"""
    db = get_database()
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Verify user exists
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get all clients for this user
    clients = list(db.clients.find({"userId": user_id}))
    
    # Add job count for each client
    for client in clients:
        client_id = str(client["_id"])
        job_count = db.jobs.count_documents({"clientId": client_id})
        invoice_count = db.invoices.count_documents({"clientId": client_id})
        client["jobCount"] = job_count
        client["invoiceCount"] = invoice_count
    
    return clients

@router.get("/{user_id}/jobs", response_model=List[Dict[str, Any]])
async def get_user_jobs(user_id: str, status_filter: str = None):
    """Get all jobs for a specific user, optionally filtered by status"""
    db = get_database()
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Verify user exists
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Build query
    query = {"userId": user_id}
    if status_filter:
        query["status"] = status_filter
    
    # Get jobs and add client info
    jobs = list(db.jobs.find(query))
    
    for job in jobs:
        # Add client info
        if job.get("clientId"):
            client = db.clients.find_one({"_id": ObjectId(job["clientId"])})
            if client:
                job["clientName"] = client.get("name")
                job["clientEmail"] = client.get("email")
    
    return jobs

@router.get("/{user_id}/invoices", response_model=List[Dict[str, Any]])
async def get_user_invoices(user_id: str, status_filter: str = None):
    """Get all invoices for a specific user, optionally filtered by status"""
    db = get_database()
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Verify user exists
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Build query
    query = {"userId": user_id}
    if status_filter:
        query["status"] = status_filter
    
    # Get invoices and add client info
    invoices = list(db.invoices.find(query))
    
    for invoice in invoices:
        # Add client info
        if invoice.get("clientId"):
            client = db.clients.find_one({"_id": ObjectId(invoice["clientId"])})
            if client:
                invoice["clientName"] = client.get("name")
        
        # Add job info if exists
        if invoice.get("jobId"):
            job = db.jobs.find_one({"_id": ObjectId(invoice["jobId"])})
            if job:
                invoice["jobTitle"] = job.get("title")
    
    return invoices

@router.get("/{user_id}/summary")
async def get_user_summary(user_id: str):
    """Get a summary of user's data including counts and totals"""
    db = get_database()
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Get user
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Count related documents
    client_count = db.clients.count_documents({"userId": user_id})
    job_count = db.jobs.count_documents({"userId": user_id})
    invoice_count = db.invoices.count_documents({"userId": user_id})
    
    # Get job status breakdown
    jobs_pending = db.jobs.count_documents({"userId": user_id, "status": "pending"})
    jobs_in_progress = db.jobs.count_documents({"userId": user_id, "status": "in_progress"})
    jobs_completed = db.jobs.count_documents({"userId": user_id, "status": "completed"})
    
    # Get invoice status breakdown
    invoices_draft = db.invoices.count_documents({"userId": user_id, "status": "draft"})
    invoices_sent = db.invoices.count_documents({"userId": user_id, "status": "sent"})
    invoices_paid = db.invoices.count_documents({"userId": user_id, "status": "paid"})
    invoices_overdue = db.invoices.count_documents({"userId": user_id, "status": "overdue"})
    
    # Calculate total revenue (from paid invoices)
    paid_invoices = list(db.invoices.find({"userId": user_id, "status": "paid"}))
    total_revenue = sum(inv.get("total", 0) for inv in paid_invoices)
    
    # Calculate pending revenue (from sent invoices)
    sent_invoices = list(db.invoices.find({"userId": user_id, "status": "sent"}))
    pending_revenue = sum(inv.get("total", 0) for inv in sent_invoices)
    
    return {
        "user": {
            "_id": str(user["_id"]),
            "businessName": user.get("businessName"),
            "businessEmail": user.get("businessEmail"),
            "businessCategory": user.get("businessCategory"),
            "hourlyRate": user.get("hourlyRate")
        },
        "counts": {
            "clients": client_count,
            "jobs": job_count,
            "invoices": invoice_count
        },
        "jobs": {
            "pending": jobs_pending,
            "inProgress": jobs_in_progress,
            "completed": jobs_completed
        },
        "invoices": {
            "draft": invoices_draft,
            "sent": invoices_sent,
            "paid": invoices_paid,
            "overdue": invoices_overdue
        },
        "revenue": {
            "total": total_revenue,
            "pending": pending_revenue
        }
    }

