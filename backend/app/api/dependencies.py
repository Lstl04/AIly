# backend/app/api/dependencies.py
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def verify_token(token: str = Depends(oauth2_scheme)):
    """
    Skip token verification - decode without verification for development.
    WARNING: This bypasses all security checks. Only use for development!
    """
    try:
        # Decode token without verification (skip_security=True)
        payload = jwt.decode(
            token,
            options={"verify_signature": False, "verify_exp": False, "verify_aud": False, "verify_iss": False}
        )
        return payload
    except Exception as e:
        # Even if decoding fails, return a dummy payload for development
        return {
            "sub": "dev-user",
            "email": "dev@example.com"
        }