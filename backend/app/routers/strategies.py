from fastapi import APIRouter, HTTPException
from app.models import StrategyCreate, StrategyResponse, StrategyLastResult
from app.database import get_supabase
import uuid

router = APIRouter()


@router.get("/", response_model=list[StrategyResponse])
def list_strategies():
    try:
        db = get_supabase()
        result = db.table("strategies").select("*").order("created_at", desc=True).execute()
        strategies = result.data or []

        if strategies:
            try:
                strategy_ids = [s["id"] for s in strategies]
                br = db.table("backtest_results") \
                    .select("strategy_id,final_balance,roi_pct,win_rate,total_trades,max_drawdown") \
                    .in_("strategy_id", strategy_ids) \
                    .execute()

                latest_map: dict = {}
                for r in (br.data or []):
                    sid = r.get("strategy_id")
                    if sid and sid not in latest_map:
                        latest_map[sid] = StrategyLastResult(
                            final_balance=r.get("final_balance"),
                            roi_pct=r.get("roi_pct"),
                            win_rate=r.get("win_rate"),
                            total_trades=r.get("total_trades"),
                            max_drawdown=r.get("max_drawdown"),
                            total_fees=r.get("total_fees"),
                        )

                for s in strategies:
                    s["last_result"] = latest_map.get(s["id"])
            except Exception as inner_e:
                print(f"[strategies] last_result fetch failed (non-fatal): {inner_e}")

        return strategies
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list strategies: {str(e)}")


@router.get("/{strategy_id}", response_model=StrategyResponse)
def get_strategy(strategy_id: str):
    try:
        db = get_supabase()
        result = db.table("strategies").select("*").eq("id", strategy_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Strategy not found")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get strategy: {str(e)}")


@router.post("/", response_model=StrategyResponse)
def create_strategy(strategy: StrategyCreate):
    try:
        db = get_supabase()
        record = {
            "id": str(uuid.uuid4()),
            "name": strategy.name,
            "config": strategy.config.model_dump(),
        }
        result = db.table("strategies").insert(record).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Insert returned no data — check your Supabase table schema")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save strategy: {str(e)}")


@router.put("/{strategy_id}", response_model=StrategyResponse)
def update_strategy(strategy_id: str, strategy: StrategyCreate):
    try:
        db = get_supabase()
        result = db.table("strategies").update({
            "name": strategy.name,
            "config": strategy.config.model_dump(),
        }).eq("id", strategy_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Strategy not found")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update strategy: {str(e)}")


@router.delete("/{strategy_id}")
def delete_strategy(strategy_id: str):
    try:
        db = get_supabase()
        db.table("strategies").delete().eq("id", strategy_id).execute()
        return {"detail": "Strategy deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete strategy: {str(e)}")
