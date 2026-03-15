from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from flowchart_routes import router as flowchart_router


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(flowchart_router)