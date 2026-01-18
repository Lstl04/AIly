# Auth0 Configuration Setup

## Problem
Getting 401 Unauthorized error with `{"detail":"Could not validate credentials"}` when signing up for the first time.

## Root Cause
The backend's `verify_token` function in `backend/app/api/dependencies.py` requires `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` environment variables to validate JWT tokens from Auth0, but these are not configured in a `.env` file.

## Solution

### Create a `.env` file in the `backend/` directory with the following content:

```env
# MongoDB Configuration
MONGODB_URI=your_mongodb_uri_here
DATABASE_NAME=PersonalCFO

# Auth0 Configuration
AUTH0_DOMAIN=dev-auxamjb2ab0y6cyh.us.auth0.com
AUTH0_AUDIENCE=https://personalcfo.com

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000

# Security
SECRET_KEY=dev-secret-key-change-in-production
```

### Steps to Fix:

1. **Create the `.env` file in the backend directory:**
   ```bash
   cd backend
   # On Windows PowerShell:
   New-Item -Path .env -ItemType File
   ```

2. **Copy the configuration above into the `.env` file**
   - Make sure to replace `your_mongodb_uri_here` with your actual MongoDB connection string

3. **Restart your backend server:**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Why This Fixes the Issue:

1. The frontend (in `frontend/src/main.jsx`) sends Auth0 tokens with:
   - `domain`: `dev-auxamjb2ab0y6cyh.us.auth0.com`
   - `audience`: `https://personalcfo.com`

2. The backend (in `backend/app/api/dependencies.py`) validates these tokens by checking:
   - The `issuer` matches `https://{AUTH0_DOMAIN}/`
   - The `audience` matches `AUTH0_AUDIENCE`

3. Without the `.env` file, these variables are `None`, causing the JWT validation to fail and return a 401 error.

### After the Fix:

Once the `.env` file is created with the correct values:
1. New users signing up will successfully authenticate
2. The `/api/users/sync` endpoint will work
3. Users will be created in the database with `onboarding_complete: false`
4. They'll be redirected to the onboarding page to complete their profile
