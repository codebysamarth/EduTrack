from dotenv import load_dotenv
import os

load_dotenv()

# ─── LLM Provider ────────────────────────────────────
LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "openai")  # "openai" or "ollama"

# ─── OpenAI ───────────────────────────────────────
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# ─── Ollama ───────────────────────────────────────
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