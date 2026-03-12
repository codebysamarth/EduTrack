"""
Quick GPT API key test — gpt-4o-mini (rate limit friendly: ~5 req/s on free tier).
Usage:
  1. Set OPENAI_API_KEY in .env or environment
  2. Run: python test_gpt.py
"""

import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

if not OPENAI_API_KEY:
    print("ERROR: OPENAI_API_KEY not set. Add it to ai-backend/.env")
    print('  echo OPENAI_API_KEY=sk-... >> .env')
    exit(1)


async def test_openai():
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage

    llm = ChatOpenAI(
        model="gpt-4o-mini",
        api_key=OPENAI_API_KEY,
        temperature=0.7,
        max_tokens=100,
    )

    print("Testing GPT-4o-mini API key...")
    print("-" * 40)

    try:
        response = await llm.ainvoke([
            HumanMessage(content="What lenght of output can you generate at once?")
        ])
        
        print(f"Response: {response.content.strip()}")
        print("-" * 40)
        print("SUCCESS — API key is valid and working!")

    except Exception as e:
        print(f"FAILED: {e}")
        exit(1)


if __name__ == "__main__":
    asyncio.run(test_openai())