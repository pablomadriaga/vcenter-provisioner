"""Backup Service - vCenter Provisioner"""
import os
import sys
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

# 12-Factor: Config via Env Vars
PORT = int(os.getenv("PORT", 8000))
CORS_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "*")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    print(f"Backup service starting on port {PORT}")
    yield
    # Shutdown logic
    print("Shutting down gracefully...")
    # Cleanup resources here

app = FastAPI(lifespan=lifespan)

# Register CORS
origins = ["*"] if CORS_ORIGINS == "*" else CORS_ORIGINS.split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EchoRequest(BaseModel):
    id: int
    name: str

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# ... rest of the routes ...
