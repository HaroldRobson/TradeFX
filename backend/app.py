from __future__ import annotations

import os
import uuid
from typing import List, Optional

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from auth import router as auth_router

BASE_URL = "https://api.circle.com/v1/w3s"
VITE_CIRCLE_API_KEY = os.getenv("VITE_CIRCLE_API_KEY")
CIRCLE_APP_ID = os.getenv("CIRCLE_APP_ID")
DEFAULT_BLOCKCHAINS = ["SOL-DEVNET"]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


def _require_env(value: Optional[str], name: str) -> str:
    if not value:
        raise HTTPException(
            status_code=500,
            detail=f"{name} is not configured on the backend.",
        )
    return value


def _blockchains(blockchains: Optional[List[str]]) -> List[str]:
    if blockchains:
        return blockchains
    return DEFAULT_BLOCKCHAINS


def _headers(extra: Optional[dict[str, str]] = None) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {_require_env(VITE_CIRCLE_API_KEY, 'VITE_CIRCLE_API_KEY')}",
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


def _post(path: str, payload: dict, *, headers: Optional[dict[str, str]] = None, tolerate_conflict: bool = False) -> dict:
    resp = requests.post(f"{BASE_URL}{path}", json=payload, headers=headers or _headers())
    if resp.ok:
        return resp.json()
    if tolerate_conflict and resp.status_code == 409:
        return resp.json()
    raise HTTPException(status_code=resp.status_code, detail=resp.text)


def _create_circle_user(user_id: str) -> None:
    payload = {"userId": user_id}
    _post("/users", payload, tolerate_conflict=True)


def _create_user_session(user_id: str) -> dict:
    payload = {"userId": user_id}
    data = _post("/users/token", payload).get("data", {})
    if not data.get("userToken") or not data.get("encryptionKey"):
        raise HTTPException(status_code=502, detail="Circle API did not return userToken/encryptionKey.")
    return data


def _initialize_wallet(user_token: str, account_type: str, blockchains: List[str]) -> Optional[str]:
    payload = {
        "idempotencyKey": str(uuid.uuid4()),
        "accountType": account_type,
        "blockchains": blockchains,
    }
    data = _post(
        "/user/initialize",
        payload,
        headers=_headers({"X-User-Token": user_token}),
    ).get("data", {})
    return data.get("challengeId")


class InitializeWalletRequest(BaseModel):
    method: str = Field(default="pin", description="Currently informational only.")
    userId: Optional[str] = Field(default=None, description="Provide to reuse an existing Circle user.")
    blockchains: Optional[List[str]] = Field(
        default=None,
        description="List of blockchains to initialize wallets on. Defaults to SOL-DEVNET.",
    )
    accountType: str = Field(default="EOA", description="Circle account type (EOA or SCA).")


class InitializeWalletResponse(BaseModel):
    appId: str
    userId: str
    userToken: str
    encryptionKey: str
    challengeId: Optional[str] = None


class CreateWalletRequest(BaseModel):
    userToken: str
    blockchains: Optional[List[str]] = None
    accountType: str = "EOA"


class CreateWalletResponse(BaseModel):
    challengeId: Optional[str] = None


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "hasApiKey": bool(VITE_CIRCLE_API_KEY),
        "hasAppId": bool(CIRCLE_APP_ID),
    }


@app.get("/api/circle/get-app-id", response_model=dict)
def get_app_id():
    return {"appId": _require_env(CIRCLE_APP_ID, "CIRCLE_APP_ID")}


@app.post("/api/circle/initialize-wallet", response_model=InitializeWalletResponse)
def initialize_wallet_endpoint(payload: InitializeWalletRequest):
    user_id = payload.userId or f"user-{uuid.uuid4()}"
    _create_circle_user(user_id)
    session = _create_user_session(user_id)
    challenge_id = _initialize_wallet(
        session["userToken"],
        payload.accountType,
        _blockchains(payload.blockchains),
    )

    return InitializeWalletResponse(
        appId=_require_env(CIRCLE_APP_ID, "CIRCLE_APP_ID"),
        userId=user_id,
        userToken=session["userToken"],
        encryptionKey=session["encryptionKey"],
        challengeId=challenge_id,
    )


@app.post("/api/circle/create-wallet", response_model=CreateWalletResponse)
def create_wallet_endpoint(payload: CreateWalletRequest):
    if not payload.userToken:
        raise HTTPException(status_code=400, detail="userToken is required.")

    challenge_id = _initialize_wallet(
        payload.userToken,
        payload.accountType,
        _blockchains(payload.blockchains),
    )
    return CreateWalletResponse(challengeId=challenge_id)

