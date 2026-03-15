"""
NuvoVet Authentication Module

Handles user registration, login, and session management via JWT.
Uses SQLite for persistent user storage and passlib[bcrypt] for password hashing.
"""

import os
import sqlite3
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt

logger = logging.getLogger("nuvovet.auth")

# ── Config ────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get(
    "NUVOVET_SECRET_KEY",
    "nuvovet-dev-secret-change-in-production-9Heav2024"
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

DB_PATH = Path(__file__).parent / "data" / "users.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# ── Password hashing ──────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── JWT bearer ────────────────────────────────────────────────────
security = HTTPBearer(auto_error=False)


# ── Database helpers ──────────────────────────────────────────────

def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create the users table and seed the default admin account."""
    conn = _get_conn()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT    UNIQUE NOT NULL,
                password_hash TEXT    NOT NULL,
                created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.commit()

        # Seed admin/admin on first run
        existing = conn.execute(
            "SELECT id FROM users WHERE username = ?", ("admin",)
        ).fetchone()
        if not existing:
            hashed = pwd_context.hash("admin")
            conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                ("admin", hashed),
            )
            conn.commit()
            logger.info("Seeded default admin account (username: admin, password: admin)")
    finally:
        conn.close()


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

    conn = _get_conn()
    try:
        user = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
    finally:
        conn.close()

    if not user or not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(user["username"])
    return TokenResponse(access_token=token, username=user["username"])


@router.post("/signup", response_model=TokenResponse)
def signup(req: SignupRequest):
    username = (req.username or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if not req.password or len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    password_hash = pwd_context.hash(req.password)

    conn = _get_conn()
    try:
        try:
            conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, password_hash),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="Username already exists")
    finally:
        conn.close()

    token = create_access_token(username)
    return TokenResponse(access_token=token, username=username)


@router.get("/me")
def get_me(username: str = Depends(get_current_user)):
    return {"username": username, "authenticated": True}


@router.post("/logout")
def logout(username: str = Depends(get_current_user)):
    # Token invalidation is client-side (remove from localStorage)
    return {"ok": True}
