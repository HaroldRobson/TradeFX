from __future__ import annotations

import os
import uuid

import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field

BASE_URL = "https://api.circle.com/v1/w3s"
CIRCLE_API_KEY = os.getenv("CIRCLE_API_KEY")

router = APIRouter(prefix="/auth", tags=["circle-auth"])


def _require_api_key() -> str:
    if not CIRCLE_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="CIRCLE_API_KEY is not configured on the backend.",
        )
    return CIRCLE_API_KEY


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_require_api_key()}",
        "Content-Type": "application/json",
    }


class EmailTokenRequest(BaseModel):
    email: EmailStr


@router.post("/email/token")
def email_token(req: EmailTokenRequest):
    payload = {
        "email": req.email,
        "idempotencyKey": str(uuid.uuid4()),
        "deviceId": str(uuid.uuid4()),
    }
    resp = requests.post(f"{BASE_URL}/users/email/token", json=payload, headers=_headers())
    if not resp.ok:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


class EmailVerifyRequest(BaseModel):
    otp: str = Field(min_length=6, max_length=8)
    otpToken: str
    deviceToken: str


@router.post("/email/verify")
def email_verify(req: EmailVerifyRequest):
    resp = requests.post(
        f"{BASE_URL}/users/email/verify",
        json=req.dict(),
        headers=_headers(),
    )
    if not resp.ok:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()
