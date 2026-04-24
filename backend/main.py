import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from flowchart_routes import router as flowchart_router


app = FastAPI()

allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(flowchart_router)