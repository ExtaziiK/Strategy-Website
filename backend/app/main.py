from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import strategies, backtest
from app.config import settings

app = FastAPI(title="BTC Backtester API")

_origins = {o.strip() for o in settings.allowed_origins.split(",") if o.strip()}

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_origins),
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(strategies.router, prefix="/strategies", tags=["strategies"])
app.include_router(backtest.router, prefix="/backtest", tags=["backtest"])


@app.get("/health")
def health():
    return {"status": "ok"}
