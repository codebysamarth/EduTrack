from dotenv import load_dotenv
import os

load_dotenv()

# ─── LLM Provider ────────────────────────────────────
# Options: "openai" | "gemini" | "ollama"
LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "gemini")

# ─── Google Gemini (free tier) ────────────────────────
# Supports multiple comma-separated keys for rotation on quota exhaustion
_raw_keys = os.getenv("GEMINI_API_KEYS", os.getenv("GEMINI_API_KEY", ""))
GEMINI_API_KEYS: list[str] = [k.strip() for k in _raw_keys.split(",") if k.strip()]
GEMINI_API_KEY: str = GEMINI_API_KEYS[0] if GEMINI_API_KEYS else ""
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# ─── OpenAI ───────────────────────────────────────────
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# ─── Ollama (local, free) ─────────────────────────────
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3:8b")

NODE_BACKEND_URL: str = os.getenv("NODE_BACKEND_URL", "http://localhost:5000")
DATABASE_URL: str = os.getenv("DATABASE_URL", "")
PORT: int = int(os.getenv("PORT", "8000"))

# Google OAuth — paths
GOOGLE_CLIENT_SECRET_PATH: str = os.path.join(
    os.path.dirname(__file__), "credentials", "client_secret.json"
)
GOOGLE_TOKEN_PATH: str = os.path.join(
    os.path.dirname(__file__), "credentials", "token.json"
)

# OAuth scopes — include ALL future scopes now so user only authenticates once
GOOGLE_SCOPES: list = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]