"""
Quick Gemini API key test — gemini-2.5-flash (free tier).
Usage:
  1. Set GEMINI_API_KEY in ai-backend/.env
     Get a free key at: https://aistudio.google.com/apikey
  2. Run: python test_gpt.py
"""

import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

if not GEMINI_API_KEY:
    print("ERROR: GEMINI_API_KEY not set. Add it to ai-backend/.env")
    print('  GEMINI_API_KEY=your-key-here')
    print("  Get a free key at: https://aistudio.google.com/apikey")
    exit(1)


async def test_gemini():
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.messages import HumanMessage

    llm = ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        google_api_key=GEMINI_API_KEY,
        temperature=0.8,
    )

    print(f"Testing {GEMINI_MODEL} API key...")
    print("-" * 40)

    try:
        response = await llm.ainvoke([
            HumanMessage(content="What are your capabilities?")
        ])

        print(f"Response: {response.content.strip()}")
        print("-" * 40)
        print("SUCCESS — Gemini API key is valid and working!")

    except Exception as e:
        print(f"FAILED: {e}")
        exit(1)


if __name__ == "__main__":
    asyncio.run(test_gemini())