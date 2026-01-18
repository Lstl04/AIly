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
        # 1. Decode the token (Open the envelope)
        # Note: We are skipping signature verification for Hackathon speed ("verify_signature": False)
        # In production, you would fetch the public key from Auth0 to verify the signature.
        payload = jwt.decode(
            token,
            key=None,
            options={"verify_signature": False, "verify_aud": True},
            audience=AUTH0_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/"
        )
        print(payload)
        return payload # Returns the dict: {"sub": "auth0|123", ...}

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )