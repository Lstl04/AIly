from fastapi import APIRouter, HTTPException, status
from typing import List
from bson import ObjectId
from datetime import datetime

from ..models import Expense, ExpenseCreate, ExpenseUpdate, MessageResponse
from ..database import get_database

router = APIRouter(prefix="/expenses", tags=["expenses"])

def serialize_expense(expense_doc):
    """Convert ObjectId fields to strings for JSON response"""
    if expense_doc is None:
        return None
    
    # Convert ObjectId fields to strings
    if "_id" in expense_doc and isinstance(expense_doc["_id"], ObjectId):
        expense_doc["_id"] = str(expense_doc["_id"])
    if "userId" in expense_doc and isinstance(expense_doc["userId"], ObjectId):
        expense_doc["userId"] = str(expense_doc["userId"])
    if "jobId" in expense_doc and isinstance(expense_doc["jobId"], ObjectId):
        expense_doc["jobId"] = str(expense_doc["jobId"])
    
    return expense_doc

@router.post("/", response_model=Expense, status_code=status.HTTP_201_CREATED)
async def create_expense(expense: ExpenseCreate):
    """Create a new expense (from receipt scan)"""
    db = get_database()
    
    # Validate user ID
    if not ObjectId.is_valid(expense.userId):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Validate job ID if provided
    if expense.jobId and not ObjectId.is_valid(expense.jobId):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format"
        )
    
    # Prepare expense data
    expense_dict = expense.model_dump(exclude_unset=True)
    expense_dict["createdAt"] = datetime.utcnow()
    
    # Convert userId to ObjectId for storage
    expense_dict["userId"] = ObjectId(expense.userId)
    
    # Convert jobId to ObjectId if provided
    if expense.jobId:
        expense_dict["jobId"] = ObjectId(expense.jobId)
    
    # Insert expense
    result = db.expenses.insert_one(expense_dict)
    
    # Return created expense
    created_expense = db.expenses.find_one({"_id": result.inserted_id})
    return serialize_expense(created_expense)

@router.get("/", response_model=List[Expense])
async def get_expenses(
    user_id: str = None,
    job_id: str = None,
    skip: int = 0,
    limit: int = 100
):
    """Get all expenses with optional filters"""
    db = get_database()
    
    query = {}
    if user_id:
        if ObjectId.is_valid(user_id):
            query["userId"] = ObjectId(user_id)
        else:
            query["userId"] = user_id
    if job_id:
        if ObjectId.is_valid(job_id):
            query["jobId"] = ObjectId(job_id)
        else:
            query["jobId"] = job_id
    
    expenses = list(db.expenses.find(query).sort("date", -1).skip(skip).limit(limit))
    return [serialize_expense(exp) for exp in expenses]

@router.get("/{expense_id}", response_model=Expense)
async def get_expense(expense_id: str):
    """Get a specific expense by ID"""
    db = get_database()
    
    if not ObjectId.is_valid(expense_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid expense ID format"
        )
    
    expense = db.expenses.find_one({"_id": ObjectId(expense_id)})
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    
    return serialize_expense(expense)

@router.put("/{expense_id}", response_model=Expense)
async def update_expense(expense_id: str, expense_update: ExpenseUpdate):
    """Update an expense"""
    db = get_database()
    
    if not ObjectId.is_valid(expense_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid expense ID format"
        )
    
    update_data = expense_update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    # Convert IDs to ObjectId if present
    if "userId" in update_data and update_data["userId"]:
        update_data["userId"] = ObjectId(update_data["userId"])
    if "jobId" in update_data and update_data["jobId"]:
        update_data["jobId"] = ObjectId(update_data["jobId"])
    
    result = db.expenses.update_one(
        {"_id": ObjectId(expense_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    
    updated_expense = db.expenses.find_one({"_id": ObjectId(expense_id)})
    return serialize_expense(updated_expense)

@router.delete("/{expense_id}", response_model=MessageResponse)
async def delete_expense(expense_id: str):
    """Delete an expense"""
    db = get_database()
    
    if not ObjectId.is_valid(expense_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid expense ID format"
        )
    
    result = db.expenses.delete_one({"_id": ObjectId(expense_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    
    return {"message": f"Expense {expense_id} deleted successfully"}

# ===== SUMMARY ENDPOINTS =====

@router.get("/summary/by-user/{user_id}")
async def get_expense_summary(user_id: str):
    """Get expense summary for a user"""
    db = get_database()
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
    
    # Get all expenses for user
    expenses = list(db.expenses.find({"userId": ObjectId(user_id)}))
    
    total_expenses = sum(exp.get("totalAmount", 0) for exp in expenses)
    total_tax = sum(exp.get("taxAmount", 0) for exp in expenses)
    expense_count = len(expenses)
    
    return {
        "userId": user_id,
        "totalExpenses": total_expenses,
        "totalTax": total_tax,
        "expenseCount": expense_count,
        "expenses": [serialize_expense(exp) for exp in expenses]
    }
