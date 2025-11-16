import os
import uuid
import json
import requests
from dotenv import load_dotenv

load_dotenv()

VITE_CIRCLE_API_KEY = os.getenv("VITE_CIRCLE_API_KEY")
BASE_URL = "https://api.circle.com/v1/w3s"

if not VITE_CIRCLE_API_KEY:
    raise RuntimeError("VITE_CIRCLE_API_KEY not set in environment / .env")


def _auth_headers(extra: dict | None = None) -> dict:
    headers = {
        "Authorization": f"Bearer {VITE_CIRCLE_API_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


def create_user(user_id: str) -> None:
    """
    POST /users
    Creates the logical Circle user (no wallets yet).
    """
    url = f"{BASE_URL}/users"
    payload = {"userId": user_id}

    resp = requests.post(url, headers=_auth_headers(), json=payload)
    if not resp.ok:
        raise RuntimeError(f"Create user failed: {resp.status_code} {resp.text}")

    # Response body is {} on success
    print("✅ User created:", user_id)


def get_user_token(user_id: str) -> dict:
    """
    POST /users/token
    Returns { userToken, encryptionKey }
    """
    url = f"{BASE_URL}/users/token"
    payload = {"userId": user_id}

    resp = requests.post(url, headers=_auth_headers(), json=payload)
    if not resp.ok:
        raise RuntimeError(f"Get user token failed: {resp.status_code} {resp.text}")

    data = resp.json().get("data", {})
    print("✅ User token + encryption key acquired")
    return {
        "userToken": data.get("userToken"),
        "encryptionKey": data.get("encryptionKey"),
    }


def initialize_user_with_wallet(
    user_token: str,
    account_type: str = "EOA",           # or "SCA"
    blockchains: list[str] | None = None # e.g. ["SOL-DEVNET"], ["MATIC-AMOY"], etc.
) -> str:
    """
    POST /user/initialize
    Creates a PIN challenge + wallet(s) on the specified blockchain(s).

    Returns:
        challengeId (str)
    """
    if blockchains is None:
        blockchains = ["SOL-DEVNET"]

    url = f"{BASE_URL}/user/initialize"
    payload = {
        "idempotencyKey": str(uuid.uuid4()),
        "accountType": account_type,
        "blockchains": blockchains,
    }

    headers = _auth_headers({"X-User-Token": user_token})
    resp = requests.post(url, headers=headers, json=payload)

    if not resp.ok:
        raise RuntimeError(f"Initialize user failed: {resp.status_code} {resp.text}")

    data = resp.json().get("data", {})
    challenge_id = data.get("challengeId")

    print("✅ Initialization challenge created. challengeId:", challenge_id)
    return challenge_id


def get_user_by_token(user_token: str) -> dict:
    """
    GET /user
    Fetches user info associated with a given userToken.
    """
    # ❌ old:
    # url = f"{BASE_URL}/users/me"

    # ✅ correct per API reference:
    url = f"{BASE_URL}/user"

    headers = _auth_headers({"X-User-Token": user_token})

    resp = requests.get(url, headers=headers)
    if not resp.ok:
        raise RuntimeError(f"Get user by token failed: {resp.status_code} {resp.text}")

    data = resp.json()
    print("✅ User fetched by token")
    return data

def list_wallets(user_token: str) -> dict:
    """
    GET /wallets
    Lists wallets for the user identified by X-User-Token.
    """
    url = f"{BASE_URL}/wallets"
    headers = _auth_headers({"X-User-Token": user_token})

    resp = requests.get(url, headers=headers)
    if not resp.ok:
        raise RuntimeError(f"List wallets failed: {resp.status_code} {resp.text}")

    data = resp.json()
    print("✅ Wallets listed")
    return data


if __name__ == "__main__":
    # 1) Generate a userId from your own system (for demo: random UUID)
    user_id = str(uuid.uuid4())
    print("Using userId:", user_id)

    # 2) Create the Circle user
    create_user(user_id)

    # 3) Get userToken + encryptionKey (backend session token)
    session = get_user_token(user_id)
    user_token = session["userToken"]
    encryption_key = session["encryptionKey"]

    # 4) Initialize user with a wallet on SOL-DEVNET (or whatever chain you want)
    challenge_id = initialize_user_with_wallet(
        user_token=user_token,
        account_type="EOA",
        blockchains=["SOL-DEVNET"],
    )

    # 5) Optionally inspect the user + wallets (wallets will fully exist after Web SDK completes the challenge)
    user_info = get_user_by_token(user_token)
    wallets = list_wallets(user_token)

    print("\n=== Backend session + challenge for Web SDK ===")
    print(json.dumps(
        {
            "userId": user_id,
            "userToken": user_token,
            "encryptionKey": encryption_key,
            "challengeId": challenge_id,
        },
        indent=2,
    ))

    print("\n=== User info ===")
    print(json.dumps(user_info, indent=2))

    print("\n=== Wallets (may be empty until PIN challenge completed) ===")
    print(json.dumps(wallets, indent=2))
