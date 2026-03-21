from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import strategies, backtest

app = FastAPI(title="BTC Backtester API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(strategies.router, prefix="/strategies", tags=["strategies"])
app.include_router(backtest.router, prefix="/backtest", tags=["backtest"])


@app.get("/health")
def health():
    return {"status": "ok"}
