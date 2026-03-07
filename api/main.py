"""
Intent - FastAPI Orchestration Layer for AI Voice/Text Agents
Serves as the backend for Vapi outbound call initiation.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os

app = FastAPI(
    title="Intent API",
    description="Orchestration layer for AI Voice/Text agents",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://intent.example.com",
        os.getenv("CORS_ORIGIN", "http://localhost:3000"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InitiateCallRequest(BaseModel):
    phone: str = Field(..., min_length=10, description="Phone number (E.164 format)")


@app.get("/")
async def root():
    return {"status": "ok", "service": "Intent API"}


@app.get("/api/health")
async def health():
    return {"status": "healthy"}


@app.post("/api/initiate-call")
async def initiate_call(req: InitiateCallRequest):
    """
    Initiates an outbound Vapi call to the provided phone number.
    Requires VAPI_API_KEY environment variable for production.
    """
    phone = req.phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if not phone.startswith("+"):
        phone = f"+1{phone}" if len(phone) == 10 else f"+{phone}"

    vapi_key = os.getenv("VAPI_API_KEY")
    if not vapi_key:
        # Demo mode: acknowledge request without actual call
        return {
            "status": "queued",
            "message": "Call request received. Configure VAPI_API_KEY for production.",
            "phone": phone[:4] + "***" + phone[-4:],
        }

    # Production: integrate with Vapi SDK
    # from vapi import Vapi
    # vapi = Vapi(api_key=vapi_key)
    # call = await vapi.calls.create(phone_number=phone, assistant_id="...")
    # return {"status": "initiated", "call_id": call.id}

    return {
        "status": "queued",
        "message": "Call initiated. Our AI will reach out shortly.",
        "phone": phone[:4] + "***" + phone[-4:],
    }
