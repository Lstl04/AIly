# MongoDB Atlas Database Setup Guide

## ✅ What's Been Configured

Your backend is now fully set up to connect to MongoDB Atlas with:
- 4 collections: **users**, **clients**, **jobs**, **invoices**
- Complete CRUD operations for all collections
- Pydantic models matching your MongoDB schemas
- RESTful API endpoints with proper validation

---

## 🚀 Quick Start

### 1. Create Your `.env` File

Create a file called `.env` in the `backend/` directory:

```bash
cd backend
# Copy the example file
cp env.example .env
```

### 2. Add Your MongoDB Connection String

Edit `backend/.env` and replace with your actual MongoDB Atlas credentials:

```env
# Get this from MongoDB Atlas → Databases → Connect → Connect your application
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/?retryWrites=true&w=majority
DATABASE_NAME=PersonalCFO

API_HOST=0.0.0.0
API_PORT=8000

SECRET_KEY=your-secret-key-here
```

**How to get your MongoDB connection string:**
1. Go to MongoDB Atlas dashboard
2. Click "Database" → "Connect"
3. Choose "Connect your application"
4. Select Python / 3.6 or later
5. Copy the connection string
6. Replace `<username>` and `<password>` with your database user credentials

### 3. Install Dependencies

```bash
cd backend
# Activate your virtual environment
.\mchacks\Scripts\activate  # Windows
# or
source mchacks/bin/activate  # Mac/Linux

# Install requirements
pip install -r app/requirements.txt
```

### 4. Run the API

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

You should see:
```
🚀 Starting up My Personal CFO API...
✅ Connected to MongoDB database: PersonalCFO
Available collections: ['users', 'clients', 'jobs', 'invoices']
✅ API ready to accept requests!
```

### 5. Test the Connection

Open your browser to:
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **Root**: http://localhost:8000

---

## 📚 API Endpoints

### Users
- `POST   /api/users` - Create a user
- `GET    /api/users` - Get all users
- `GET    /api/users/{user_id}` - Get specific user
- `PUT    /api/users/{user_id}` - Update user
- `DELETE /api/users/{user_id}` - Delete user

### Clients
- `POST   /api/clients` - Create a client
- `GET    /api/clients?user_id=xyz` - Get clients (optionally filter by user)
- `GET    /api/clients/{client_id}` - Get specific client
- `PUT    /api/clients/{client_id}` - Update client
- `DELETE /api/clients/{client_id}` - Delete client

### Jobs
- `POST   /api/jobs` - Create a job
- `GET    /api/jobs?user_id=xyz&status=in_progress` - Get jobs (with filters)
- `GET    /api/jobs/{job_id}` - Get specific job
- `PUT    /api/jobs/{job_id}` - Update job
- `DELETE /api/jobs/{job_id}` - Delete job

### Invoices
- `POST   /api/invoices` - Create an invoice (auto-generates invoice number!)
- `GET    /api/invoices?user_id=xyz` - Get invoices (with filters)
- `GET    /api/invoices/{invoice_id}` - Get specific invoice
- `PUT    /api/invoices/{invoice_id}` - Update invoice
- `DELETE /api/invoices/{invoice_id}` - Delete invoice

---

## 🧪 Testing with FastAPI Docs

1. Go to **http://localhost:8000/docs**
2. You'll see all endpoints with interactive documentation
3. Click "Try it out" on any endpoint
4. Fill in the request body
5. Click "Execute"

### Example: Create a User

Click on `POST /api/users`, then "Try it out":

```json
{
  "businessName": "John's Contracting",
  "businessEmail": "john@example.com",
  "businessPhone": "+1-555-0123",
  "businessAddress": "123 Main St, Montreal, QC",
  "businessCategory": "Construction",
  "hourlyRate": 75.00
}
```

You'll get back the created user with an `_id`!

---

## 📊 Data Models

### User
```javascript
{
  "_id": "ObjectId",
  "businessName": "string",
  "businessEmail": "string",
  "businessPhone": "string",
  "businessAddress": "string",
  "businessCategory": "string",
  "hourlyRate": 75.00,
  "lastInvoiceNumber": 1001,
  "pastItems": [],
  "created_at": "2026-01-17T..."
}
```

### Client
```javascript
{
  "_id": "ObjectId",
  "user_id": "user_id_here",
  "name": "Acme Corp",
  "email": "contact@acme.com",
  "address": "456 Business Ave"
}
```

### Job
```javascript
{
  "_id": "ObjectId",
  "user_id": "user_id_here",
  "client_id": "client_id_here",
  "title": "Office Renovation",
  "status": "in_progress",
  "start_time": "2026-01-17T09:00:00",
  "end_time": "2026-01-17T17:00:00",
  "location": "123 Office St",
  "invoice_id": "invoice_id_here"
}
```

### Invoice
```javascript
{
  "_id": "ObjectId",
  "user_id": "user_id_here",
  "client_id": "client_id_here",
  "job_id": "job_id_here",
  "invoice_number": "INV-1001",
  "status": "draft",
  "issue_date": "2026-01-17",
  "due_date": "2026-02-16",
  "line_items": [
    {
      "description": "Labor",
      "quantity": 8,
      "rate": 75.00,
      "amount": 600.00
    }
  ],
  "total": 600.00
}
```

---

## 🔗 Connecting Frontend to Backend

Your React frontend is already configured to connect! Just make API calls:

```javascript
// Example: Get all users
const response = await fetch('http://localhost:8000/api/users');
const users = await response.json();

// Example: Create a client
const response = await fetch('http://localhost:8000/api/clients', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: "New Client",
    email: "client@example.com",
    user_id: "user_id_here",
    address: "123 Street"
  })
});
```

---

## 🎯 File Structure

```
backend/
├── .env                    # ⚠️ Your secrets (DO NOT COMMIT)
├── env.example             # Template for .env
├── app/
│   ├── main.py            # FastAPI app with routes
│   ├── config.py          # Environment variables loader
│   ├── database.py        # MongoDB connection
│   ├── models.py          # Pydantic data models
│   └── routes/            # API endpoints
│       ├── __init__.py
│       ├── users.py       # User CRUD
│       ├── clients.py     # Client CRUD
│       ├── jobs.py        # Job CRUD
│       └── invoices.py    # Invoice CRUD
└── DATABASE_SETUP.md      # This file!
```

---

## 🚨 Troubleshooting

### Error: "MONGODB_URI not found"
- Make sure you created the `.env` file in the `backend/` directory
- Check that the file is named exactly `.env` (not `.env.txt`)
- Restart the server after creating `.env`

### Error: "ServerSelectionTimeoutError"
- Check your MongoDB Atlas connection string is correct
- Make sure your IP is whitelisted in MongoDB Atlas (Network Access)
- For development, you can allow `0.0.0.0/0` (all IPs)

### Error: "Database user not authorized"
- Check username and password in connection string
- Make sure the database user has read/write permissions

### Can't connect from frontend
- Make sure backend is running on `localhost:8000`
- Check CORS settings in `main.py` include your frontend URL
- Open browser console to see detailed error messages

---

## 👥 Team Collaboration

### Sharing Database Access

**Option 1: Shared Cluster (Recommended for Hackathon)**
- One person creates the MongoDB cluster
- Share the connection string securely (Discord DM, not public chat!)
- Everyone uses the same `.env` file
- You all work on the same database

**Option 2: Everyone Has Their Own**
- Each teammate creates their own free MongoDB cluster
- Everyone has their own connection string in `.env`
- Database stays separate during development

---

## 🎉 You're All Set!

Your backend is fully connected to MongoDB Atlas and ready to handle:
- ✅ User management
- ✅ Client management  
- ✅ Job tracking
- ✅ Invoice generation (with auto-incrementing numbers!)

Now you can:
1. Test the API using the docs at `/docs`
2. Connect your React frontend
3. Start building features!

Need help? Check the FastAPI docs or ask your team! 🚀
