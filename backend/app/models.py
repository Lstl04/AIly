from pydantic import BaseModel, Field
from pydantic_core import core_schema
from typing import Optional, List, Any
from datetime import datetime
from bson import ObjectId

# Custom type for MongoDB ObjectId (Pydantic v2 compatible)
class PyObjectId(str):
    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        _source_type: Any,
        _handler: Any,
    ) -> core_schema.CoreSchema:
        return core_schema.json_or_python_schema(
            json_schema=core_schema.str_schema(),
            python_schema=core_schema.union_schema([
                core_schema.is_instance_schema(ObjectId),
                core_schema.chain_schema([
                    core_schema.str_schema(),
                    core_schema.no_info_plain_validator_function(cls.validate),
                ])
            ]),
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda x: str(x)
            ),
        )
    
    @classmethod
    def validate(cls, v):
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str):
            if ObjectId.is_valid(v):
                return ObjectId(v)
        raise ValueError("Invalid ObjectId")
    
    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        return {"type": "string"}


# ===== USER MODELS =====

class UserBase(BaseModel):
    """Base user model with common fields"""
    auth0Id: Optional[str] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    personalEmail: Optional[str] = None
    businessName: Optional[str] = None
    businessEmail: Optional[str] = None
    businessPhone: Optional[str] = None
    businessAddress: Optional[str] = None
    businessCategory: Optional[str] = None
    hourlyRate: Optional[float] = None
    lastInvoiceNumber: Optional[int] = 0

class UserCreate(UserBase):
    """Model for creating a new user"""
    businessEmail: str  # Required for creation

class UserUpdate(UserBase):
    """Model for updating a user (all fields optional)"""
    pass

class User(UserBase):
    """Complete user model with database fields"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    createdAt: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
        json_schema_extra = {
            "example": {
                "businessName": "John's Contracting",
                "businessEmail": "john@example.com",
                "businessPhone": "+1-555-0123",
                "businessAddress": "123 Main St, City, State",
                "businessCategory": "Construction",
                "hourlyRate": 75.00,
                "lastInvoiceNumber": 1001
            }
        }


# ===== CLIENT MODELS =====

class ClientBase(BaseModel):
    """Base client model"""
    name: Optional[str] = None
    email: Optional[str] = None
    userId: Optional[str] = None  # Reference to user
    address: Optional[str] = None
    archived: Optional[bool] = False

class ClientCreate(ClientBase):
    """Model for creating a new client"""
    name: str  # Required
    userId: str  # Required - which user owns this client

class ClientUpdate(ClientBase):
    """Model for updating a client"""
    pass

class Client(ClientBase):
    """Complete client model with database fields"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
        json_schema_extra = {
            "example": {
                "name": "Acme Corporation",
                "email": "contact@acme.com",
                "userId": "user123",
                "address": "456 Business Ave, City, State"
            }
        }


# ===== JOB MODELS =====

class JobBase(BaseModel):
    """Base job model"""
    userId: Optional[str] = None
    clientId: Optional[str] = None
    title: Optional[str] = None
    status: Optional[str] = "pending"  # pending, in_progress, completed, cancelled
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None
    location: Optional[str] = None
    invoiceId: Optional[str] = None
    googleCalendarEventId: Optional[str] = None

class JobCreate(JobBase):
    """Model for creating a new job"""
    userId: str  # Required
    title: str  # Required
    # clientId is optional for now

class JobUpdate(JobBase):
    """Model for updating a job"""
    pass

class Job(JobBase):
    """Complete job model with database fields"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
        json_schema_extra = {
            "example": {
                "userId": "user123",
                "clientId": "client456",
                "title": "Office Renovation",
                "status": "in_progress",
                "startTime": "2026-01-17T09:00:00",
                "endTime": "2026-01-17T17:00:00",
                "location": "123 Office St"
            }
        }


# ===== INVOICE MODELS =====

class LineItem(BaseModel):
    """Line item for an invoice"""
    description: str
    quantity: float
    rate: float
    amount: float

class InvoiceBase(BaseModel):
    """Base invoice model"""
    userId: Optional[str] = None
    clientId: Optional[str] = None
    jobId: Optional[str] = None
    invoiceNumber: Optional[str] = None
    invoiceTitle: Optional[str] = None
    invoiceDescription: Optional[str] = None
    status: Optional[str] = "draft"  # draft, sent, paid, overdue, cancelled
    issueDate: Optional[datetime] = None
    dueDate: Optional[datetime] = None
    lineItems: Optional[List[LineItem]] = []
    total: Optional[float] = 0.0

class InvoiceCreate(InvoiceBase):
    """Model for creating a new invoice"""
    userId: str  # Required
    clientId: Optional[str] = ""  # Optional, can be empty string

class InvoiceUpdate(InvoiceBase):
    """Model for updating an invoice"""
    pass

class Invoice(InvoiceBase):
    """Complete invoice model with database fields"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
        json_schema_extra = {
            "example": {
                "userId": "user123",
                "clientId": "client456",
                "jobId": "job789",
                "invoiceNumber": "INV-1001",
                "status": "sent",
                "issueDate": "2026-01-17",
                "dueDate": "2026-02-16",
                "lineItems": [
                    {
                        "description": "Labor - Office Renovation",
                        "quantity": 8,
                        "rate": 75.00,
                        "amount": 600.00
                    }
                ],
                "total": 600.00
            }
        }


# ===== EXPENSE MODELS =====

class ExpenseLineItem(BaseModel):
    """Line item for an expense"""
    description: str
    quantity: float
    unitPrice: float
    total: float

class ExpenseBase(BaseModel):
    """Base expense model"""
    userId: Optional[str] = None
    vendorName: Optional[str] = None
    date: Optional[datetime] = None
    totalAmount: Optional[float] = None
    taxAmount: Optional[float] = None
    currency: Optional[str] = "USD"
    lineItems: Optional[List[ExpenseLineItem]] = []
    receiptImageUrl: Optional[str] = None
    jobId: Optional[str] = None  # Optional link to job

class ExpenseCreate(ExpenseBase):
    """Model for creating a new expense"""
    userId: str  # Required
    vendorName: str  # Required
    totalAmount: float  # Required

class ExpenseUpdate(ExpenseBase):
    """Model for updating an expense"""
    pass

class Expense(ExpenseBase):
    """Complete expense model with database fields"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    createdAt: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
        json_schema_extra = {
            "example": {
                "userId": "user123",
                "vendorName": "Office Depot",
                "date": "2026-01-17",
                "totalAmount": 154.06,
                "taxAmount": 9.06,
                "currency": "USD",
                "lineItems": [
                    {
                        "description": "Printer Paper",
                        "quantity": 2,
                        "unitPrice": 25.00,
                        "total": 50.00
                    }
                ],
                "jobId": "job789"
            }
        }


# ===== RESPONSE MODELS =====

class MessageResponse(BaseModel):
    """Standard message response"""
    message: str
    
class ErrorResponse(BaseModel):
    """Standard error response"""
    error: str
    detail: Optional[str] = None
