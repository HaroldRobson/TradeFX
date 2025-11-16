from fastapi import FastAPI
from pydantic import BaseModel
import uuid
import requests
import os

app = FastAPI()

CIRCLE_API_KEY = os.getenv("CIRCLE_API_KEY")
BASE = "https://api.circle.com/v1/w3s"


def headers():
    return {
        "Authorization": f"Bearer {CIRCLE_API_KEY}",
        "Content-Type": "application/json"
    }


class EmailTokenRequest(BaseModel):
    email: str


@app.post("/auth/email/token")
def email_token(req: EmailTokenRequest):
    url = f"{BASE}/users/email/token"
    payload = {
        "email": req.email,
        "idempotencyKey": str(uuid.uuid4()),
        "deviceId": str(uuid.uuid4())
    }
    r = requests.post(url, json=payload, headers=headers())
    return r.json()


class EmailVerifyRequest(BaseModel):
    otp: str
    otpToken: str
    deviceToken: str


@app.post("/auth/email/verify")
def email_verify(req: EmailVerifyRequest):
    url = f"{BASE}/users/email/verify"
    payload = req.dict()
    r = requests.post(url, json=payload, headers=headers())
    return r.json()
