"""
NuvoVet Authentication Module

Handles user registration, login, and session management via JWT.
Uses a JSON file for persistent user storage and bcrypt for password hashing.
"""

import os
import json
import threading
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import bcrypt
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt

logger = logging.getLogger("nuvovet.auth")

# ── Config ────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get(
    "NUVOVET_SECRET_KEY",
    "nuvovet-dev-secret-change-in-production-9Heav2024"
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

USERS_PATH = Path(__file__).parent / "data" / "users.json"
USERS_PATH.parent.mkdir(parents=True, exist_ok=True)

# Thread lock for safe concurrent file writes
_lock = threading.Lock()

# ── JWT bearer ────────────────────────────────────────────────────
security = HTTPBearer(auto_error=False)


# ── JSON user store helpers ───────────────────────────────────────

def _load_users() -> dict:
    if not USERS_PATH.exists():
        return {}
    with open(USERS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_users(users: dict) -> None:
    with _lock:
        with open(USERS_PATH, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2)


def init_db() -> None:
    """Seed the default admin account if users.json doesn't exist yet."""
    users = _load_users()
    if "admin" not in users:
        hashed = bcrypt.hashpw(b"admin", bcrypt.gensalt(12)).decode()
        users["admin"] = {
            "password_hash": hashed,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _save_users(users)
        logger.info("Seeded default admin account (username: admin, password: admin)")


# ── Pydantic models ───────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class SignupRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


# ── JWT helpers ───────────────────────────────────────────────────

def create_access_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": username, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _verify_token(token: str) -> Optional[str]:
    """Return username if token is valid, else None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


# ── FastAPI dependency ────────────────────────────────────────────

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    username = _verify_token(credentials.credentials)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return username


# ── Router ────────────────────────────────────────────────────────

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    username = (req.username or "").strip()
    if not username or not req.password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    users = _load_users()
    user = users.get(username)

    if not user or not bcrypt.checkpw(req.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(username)
    return TokenResponse(access_token=token, username=username)


@router.post("/signup", response_model=TokenResponse)
def signup(req: SignupRequest):
    username = (req.username or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if not req.password or len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    users = _load_users()
    if username in users:
        raise HTTPException(status_code=409, detail="Username already exists")

    password_hash = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt(12)).decode()
    users[username] = {
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_users(users)

    token = create_access_token(username)
    return TokenResponse(access_token=token, username=username)


@router.get("/me")
def get_me(username: str = Depends(get_current_user)):
    return {"username": username, "authenticated": True}


@router.post("/logout")
def logout(username: str = Depends(get_current_user)):
    # Token invalidation is client-side (remove from localStorage)
    return {"ok": True}
