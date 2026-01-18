from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from .config import settings
import logging

logger = logging.getLogger(__name__)

class Database:
    """MongoDB database connection manager"""
    
    def __init__(self):
        self.client = None
        self.db = None
    
    def connect(self):
        """Connect to MongoDB Atlas"""
        try:
            logger.info("Connecting to MongoDB Atlas...")
            
            # Create MongoDB client
            self.client = MongoClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=5000  # 5 second timeout
            )
            
            # Test the connection
            self.client.admin.command('ping')
            
            # Get database
            self.db = self.client[settings.DATABASE_NAME]
            
            logger.info(f"✅ Connected to MongoDB database: {settings.DATABASE_NAME}")
            
            # Log available collections
            collections = self.db.list_collection_names()
            logger.info(f"Available collections: {collections}")
            
            return self.db
            
        except ConnectionFailure as e:
            logger.error(f"❌ Failed to connect to MongoDB: {e}")
            raise Exception(f"Database connection failed: {e}")
        
        except ServerSelectionTimeoutError as e:
            logger.error(f"❌ MongoDB server selection timeout: {e}")
            raise Exception(
                "Could not connect to MongoDB Atlas. "
                "Please check your connection string and network access settings."
            )
        
        except Exception as e:
            logger.error(f"❌ Unexpected error connecting to MongoDB: {e}")
            raise
    
    def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")
    
    def get_collection(self, collection_name: str):
        """Get a specific collection from the database"""
        if self.db is None:
            raise Exception("Database not connected. Call connect() first.")
        return self.db[collection_name]
    
    # Collection shortcuts
    @property
    def users(self):
        """Get users collection"""
        return self.get_collection("users")
    
    @property
    def clients(self):
        """Get clients collection"""
        return self.get_collection("clients")
    
    @property
    def jobs(self):
        """Get jobs collection"""
        return self.get_collection("jobs")
    
    @property
    def invoices(self):
        """Get invoices collection"""
        return self.get_collection("invoices")
    
    @property
    def expenses(self):
        """Get expenses collection"""
        return self.get_collection("expenses")

# Global database instance
db = Database()

def get_database():
    """Dependency to get database instance in routes"""
    return db
