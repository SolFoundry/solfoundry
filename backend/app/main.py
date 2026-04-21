from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import random
import os
import json
import asyncio
from dotenv import load_dotenv
import anthropic
from openai import AsyncOpenAI
import google.generativeai as genai

load_dotenv()

app = FastAPI(title=\"SolFoundry Analytics API\")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

class TrendsResponse(BaseModel):
    dates: List[str]
    volume: List[int]
    payouts: List[float]

class ContributorsResponse(BaseModel):
    months: List[str]
    new_contributors: List[int]
    active_contributors: List[int]
    retention_rate: List[float]

class MetricsResponse(BaseModel):
    completion_rate: float
    avg_completion_days: float
    total_bounties: int
    total_payouts: float

class EnhanceRequest(BaseModel):
    title: str
    description: str

class LLMEnhancement(BaseModel):
    model: str
    enhanced_title: str
    enhanced_description: str
    acceptance_criteria: List[str]
    examples: List[str]

class EnhanceResponse(BaseModel):
    enhancements: List[LLMEnhancement]
    aggregated: Optional[LLMEnhancement] = None

@app.get("/health")
def health():
    return {'status': 'healthy', 'service': 'analytics'}

@app.get("/api/analytics/trends", response_model=TrendsResponse)
def get_trends(days: int = 365):
    end_date = datetime.now()
    dates = [(end_date - timedelta(days=i)).strftime('%Y-%m-%d') for i in range(days, 0, -1)]
    base_volume = 5
    volume = [base_volume + int(random.uniform(0, 10) * (days - i)/days * 3) for i in range(days)][::-1]
    payouts = [v * random.uniform(100, 500) for v in volume]
    return TrendsResponse(dates=dates[-30:], volume=volume[-30:], payouts=payouts[-30:])  # last 30 days

@app.get("/api/analytics/contributors", response_model=ContributorsResponse)
def get_contributors(months: int = 12):
    months_list = [(datetime.now() - timedelta(days=30*i)).strftime('%Y-%m') for i in range(months-1, -1, -1)]
    new = [5 + i*2 + random.randint(-2,3) for i in range(months)]
    active = [n + random.randint(0, n//2) for n in new]
    retention = [random.uniform(0.6, 0.9) for _ in range(months)]
    return ContributorsResponse(months=months_list, new_contributors=new, active_contributors=active, retention_rate=retention)

@app.get("/api/analytics/metrics", response_model=MetricsResponse)
def get_metrics():
    return MetricsResponse(
        completion_rate=0.82,
        avg_completion_days=4.2,
        total_bounties=456,
        total_payouts=125000.0
    )

async def enhance_with_llm(model_name: str, title: str, description: str) -> Optional[dict]:
    prompt = f"""You are a bounty specification expert. Enhance this vague bounty into a clear, actionable spec.

Title: {title}

Description: {description}

Output ONLY valid JSON with:
{{
  "enhanced_title": "Clear, concise title",
  "enhanced_description": "Detailed description with requirements",
  "acceptance_criteria": ["Specific AC1", "AC2", ...],
  "examples": ["Example input/output or scenario 1", "Scenario 2"]
}}
Ensure AC are testable and examples illustrate edge cases."""

    try:
        if model_name == "claude":
            client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
            if not client.api_key:
                return None
            msg = await asyncio.to_thread(client.messages.create,
                model="claude-3-5-sonnet-20240620",
                max_tokens=2000,
                temperature=0.1,
                messages=[{"role": "user", "content": prompt}]
            )
            content = msg.content[0].text.strip()
            return json.loads(content)
        elif model_name == "openai":
            client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            if not client.api_key:
                return None
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content.strip()
            return json.loads(content)
        elif model_name == "gemini":
            api_key = os.getenv("GOOGLE_API_KEY")
            if not api_key:
                return None
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-flash-exp')
            response = await asyncio.to_thread(model.generate_content, prompt)
            content = response.text.strip()
            # Extract JSON from response
            start = content.find('{')
            end = content.rfind('}') + 1
            if start != -1 and end > start:
                return json.loads(content[start:end])
            return None
    except Exception as e:
        print(f"Error with {model_name}: {e}")
        return None

@app.post("/api/enhance-bounty", response_model=EnhanceResponse)
async def enhance_bounty(request: EnhanceRequest):
    models = ["claude", "openai", "gemini"]
    tasks = [enhance_with_llm(m, request.title, request.description) for m in models]
    results = await asyncio.gather(*tasks)

    enhancements = []
    for i, res in enumerate(results):
        if res:
            enhancements.append(LLMEnhancement(
                model=models[i],
                enhanced_title=res.get('enhanced_title', ''),
                enhanced_description=res.get('enhanced_description', ''),
                acceptance_criteria=res.get('acceptance_criteria', []),
                examples=res.get('examples', [])
            ))

    # Aggregate: use openai to merge if possible
    aggregated = None
    if len(enhancements) >= 2:
        # Mock aggregate for now
        agg = enhancements[0]  # Use first
        aggregated = LLMEnhancement(
            model="aggregated",
            enhanced_title=agg.enhanced_title,
            enhanced_description=agg.enhanced_description,
            acceptance_criteria=agg.acceptance_criteria,
            examples=agg.examples
        )

    return EnhanceResponse(enhancements=enhancements, aggregated=aggregated)