# API Relationship Endpoints - Complete Guide

## 🎉 What's New

Added powerful relationship endpoints that leverage MongoDB connections between collections. These endpoints make it easy to fetch related data without multiple API calls.

---

## 📚 User Endpoints (`/api/users`)

### **GET /api/users/{user_id}/clients**
Get all clients for a specific user with job and invoice counts.

**Response includes:**
- All client data
- `jobCount` - number of jobs for each client
- `invoiceCount` - number of invoices for each client

**Example:**
```
GET /api/users/679a1b2c3d4e5f6789abcdef/clients
```

---

### **GET /api/users/{user_id}/jobs?status_filter=in_progress**
Get all jobs for a user, optionally filtered by status.

**Query Parameters:**
- `status_filter` (optional): `pending`, `in_progress`, `completed`, `cancelled`

**Response includes:**
- All job data
- `clientName` - name of the client
- `clientEmail` - client's email

**Example:**
```
GET /api/users/679a1b2c3d4e5f6789abcdef/jobs?status_filter=completed
```

---

### **GET /api/users/{user_id}/invoices?status_filter=paid**
Get all invoices for a user, optionally filtered by status.

**Query Parameters:**
- `status_filter` (optional): `draft`, `sent`, `paid`, `overdue`, `cancelled`

**Response includes:**
- All invoice data
- `clientName` - name of the client
- `jobTitle` - associated job title (if exists)

**Example:**
```
GET /api/users/679a1b2c3d4e5f6789abcdef/invoices?status_filter=paid
```

---

### **GET /api/users/{user_id}/summary**
Get a complete dashboard summary for a user.

**Response includes:**
```json
{
  "user": {
    "_id": "...",
    "businessName": "...",
    "businessEmail": "...",
    "businessCategory": "...",
    "hourlyRate": 75.0
  },
  "counts": {
    "clients": 5,
    "jobs": 12,
    "invoices": 8
  },
  "jobs": {
    "pending": 2,
    "inProgress": 3,
    "completed": 7
  },
  "invoices": {
    "draft": 1,
    "sent": 2,
    "paid": 4,
    "overdue": 1
  },
  "revenue": {
    "total": 15000.00,
    "pending": 3500.00
  }
}
```

**Perfect for dashboard displays!**

---

## 📚 Client Endpoints (`/api/clients`)

### **GET /api/clients/{client_id}/jobs?status_filter=completed**
Get all jobs for a specific client.

**Query Parameters:**
- `status_filter` (optional): `pending`, `in_progress`, `completed`, `cancelled`

**Response includes:**
- All job data
- `invoiceNumber` - invoice number (if job has invoice)
- `invoiceStatus` - invoice status (if exists)

**Example:**
```
GET /api/clients/679b1a2b3c4d5e6f7890abcd/jobs
```

---

### **GET /api/clients/{client_id}/invoices?status_filter=sent**
Get all invoices for a specific client.

**Query Parameters:**
- `status_filter` (optional): `draft`, `sent`, `paid`, `overdue`, `cancelled`

**Response includes:**
- All invoice data
- `jobTitle` - associated job title
- `jobLocation` - job location

**Example:**
```
GET /api/clients/679b1a2b3c4d5e6f7890abcd/invoices?status_filter=overdue
```

---

### **GET /api/clients/{client_id}/summary**
Get a complete summary for a client.

**Response includes:**
```json
{
  "client": {
    "_id": "...",
    "name": "Acme Corp",
    "email": "...",
    "address": "..."
  },
  "user": {
    "businessName": "John's Contracting",
    "businessEmail": "john@example.com"
  },
  "counts": {
    "jobs": 3,
    "invoices": 2
  },
  "jobs": {
    "pending": 0,
    "inProgress": 1,
    "completed": 2
  },
  "financials": {
    "totalBilled": 5000.00,
    "totalPaid": 3000.00,
    "outstanding": 2000.00
  }
}
```

---

## 📚 Job Endpoints (`/api/jobs`)

### **GET /api/jobs/{job_id}/details**
Get complete job details with all related information.

**Response includes:**
```json
{
  "job": {
    "_id": "...",
    "title": "Office Renovation",
    "status": "in_progress",
    ...
  },
  "client": {
    "_id": "...",
    "name": "Acme Corp",
    "email": "contact@acme.com",
    "address": "..."
  },
  "user": {
    "_id": "...",
    "businessName": "John's Contracting",
    "businessEmail": "john@example.com",
    "hourlyRate": 75.0
  },
  "invoice": {
    "_id": "...",
    "invoiceNumber": "INV-1001",
    "status": "sent",
    "total": 600.00,
    ...
  }
}
```

**Perfect for job detail pages!**

---

### **GET /api/jobs/{job_id}/invoice**
Get the invoice associated with a specific job.

**Returns:** Full invoice document

**Error:** 404 if job has no invoice

---

## 📚 Invoice Endpoints (`/api/invoices`)

### **GET /api/invoices/{invoice_id}/details**
Get complete invoice details with all context.

**Response includes:**
```json
{
  "invoice": {
    "_id": "...",
    "invoiceNumber": "INV-1001",
    "status": "sent",
    "lineItems": [...],
    "total": 600.00,
    ...
  },
  "user": {
    "_id": "...",
    "businessName": "John's Contracting",
    "businessEmail": "john@example.com",
    "businessPhone": "+1-555-0123",
    "businessAddress": "...",
    "hourlyRate": 75.0
  },
  "client": {
    "_id": "...",
    "name": "Acme Corp",
    "email": "contact@acme.com",
    "address": "..."
  },
  "job": {
    "_id": "...",
    "title": "Office Renovation",
    "status": "completed",
    "startTime": "...",
    "endTime": "...",
    "location": "..."
  }
}
```

---

### **GET /api/invoices/{invoice_id}/printable**
Get invoice formatted for printing or PDF generation.

**Response includes:**
```json
{
  "invoiceNumber": "INV-1001",
  "issueDate": "2026-01-17",
  "dueDate": "2026-02-16",
  "status": "sent",
  "from": {
    "businessName": "John's Contracting",
    "email": "john@example.com",
    "phone": "+1-555-0123",
    "address": "123 Main St"
  },
  "to": {
    "name": "Acme Corp",
    "email": "contact@acme.com",
    "address": "456 Business Ave"
  },
  "job": {
    "title": "Office Renovation",
    "location": "Downtown Office",
    "startTime": "...",
    "endTime": "..."
  },
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
```

**Perfect for generating PDF invoices!**

---

## 🎯 Common Use Cases

### **Dashboard View**
```javascript
// Get user summary for main dashboard
GET /api/users/{user_id}/summary

// Returns: counts, revenue, job/invoice breakdowns
```

### **Client Profile Page**
```javascript
// Get client details
GET /api/clients/{client_id}/summary

// Get all jobs for this client
GET /api/clients/{client_id}/jobs

// Get all invoices for this client
GET /api/clients/{client_id}/invoices
```

### **Job Detail Page**
```javascript
// Get complete job information
GET /api/jobs/{job_id}/details

// Returns: job, client, user, and invoice data
```

### **Invoice Generation**
```javascript
// Get printable invoice
GET /api/invoices/{invoice_id}/printable

// Format and generate PDF
```

### **Reports**
```javascript
// Get all paid invoices for a user
GET /api/users/{user_id}/invoices?status_filter=paid

// Get all completed jobs
GET /api/users/{user_id}/jobs?status_filter=completed
```

---

## 🔗 Relationship Overview

```
users (1) ←→ (many) clients
users (1) ←→ (many) jobs
users (1) ←→ (many) invoices

clients (1) ←→ (many) jobs
clients (1) ←→ (many) invoices

jobs (1) ←→ (1) invoice (optional)
```

---

## 📊 Response Performance

All relationship endpoints use efficient MongoDB queries:
- ✅ Single database connection
- ✅ Indexed lookups on `_id` fields
- ✅ Minimal data transfer
- ✅ No N+1 query problems

---

## 🧪 Testing

Visit **http://localhost:8000/docs** to see all new endpoints with interactive testing!

Each endpoint has:
- ✅ Full documentation
- ✅ Request examples
- ✅ Response schemas
- ✅ "Try it out" buttons

---

## 💡 Frontend Integration Examples

### React Example:
```javascript
// Get user summary for dashboard
const getUserDashboard = async (userId) => {
  const response = await fetch(`http://localhost:8000/api/users/${userId}/summary`);
  const data = await response.json();
  return data;
};

// Get client's jobs
const getClientJobs = async (clientId) => {
  const response = await fetch(`http://localhost:8000/api/clients/${clientId}/jobs`);
  const jobs = await response.json();
  return jobs;
};

// Get printable invoice
const getPrintableInvoice = async (invoiceId) => {
  const response = await fetch(`http://localhost:8000/api/invoices/${invoiceId}/printable`);
  const invoice = await response.json();
  return invoice;
};
```

---

## 🚀 What's Next?

Your API now has:
- ✅ Complete CRUD operations for all collections
- ✅ Field names matching MongoDB schema (camelCase)
- ✅ Relationship endpoints for connected data
- ✅ Summary endpoints for dashboards
- ✅ Printable invoice endpoint

Ready to build your frontend! 🎉
