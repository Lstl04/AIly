from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from .database import db
from .config import settings
from .routes import users_router, clients_router, jobs_router, invoices_router, expenses_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="My Personal CFO API",
    description="API for managing clients, jobs, and invoices",
    version="1.0.0"
)

# CORS middleware - allows frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event - connect to database
@app.on_event("startup")
async def startup_event():
    """Connect to MongoDB on startup"""
    try:
        logger.info("🚀 Starting up My Personal CFO API...")
        
        # Validate settings
        settings.validate()
        
        # Connect to database
        db.connect()
        
        logger.info("✅ API ready to accept requests!")
        
    except Exception as e:
        logger.error(f"❌ Startup failed: {e}")
        raise

# Shutdown event - close database connection
@app.on_event("shutdown")
async def shutdown_event():
    """Close MongoDB connection on shutdown"""
    logger.info("Shutting down...")
    db.close()

# Include routers
app.include_router(users_router, prefix="/api")
app.include_router(clients_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(invoices_router, prefix="/api")
app.include_router(expenses_router, prefix="/api")

# Root endpoint
@app.get("/")
def read_root():
    return {
        "message": "My Personal CFO API is running!",
        "version": "1.0.0",
        "docs": "/docs",
        "database": settings.DATABASE_NAME
    }

# Health check endpoint
@app.get("/health")
def health_check():
    """Check if API and database are working"""
    try:
        # Try to ping database
        db.client.admin.command('ping')
        return {
            "status": "healthy",
            "database": "connected",
            "database_name": settings.DATABASE_NAME
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }