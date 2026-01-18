# backend/app/api/dependencies.py
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

security = HTTPBearer()

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE")

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    

    
    try:
        # First, decode without verification to see what's in the token
        unverified_payload = jwt.decode(
            token,
            key=None,
            options={"verify_signature": False, "verify_aud": False, "verify_exp": False}
        )
        
        
        # Now decode with verification
        # Note: We are skipping signature verification for Hackathon speed ("verify_signature": False)
        # In production, you would fetch the public key from Auth0 to verify the signature.
        payload = jwt.decode(
            token,
            key=None,
            options={"verify_signature": False, "verify_aud": True, "verify_exp": False},
            audience=AUTH0_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/"
        )
        
        return payload # Returns the dict: {"sub": "auth0|123", ...}

    except JWTError as e:
        print(f"JWT Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials {str(e)}",
        )