from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from ..db import get_db
from ..models.database import Contributor
from ..auth.wallet import verify_solana_signature
from ..core.auth import get_current_user # The JWT dependency

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/link-wallet")
async def link_wallet(
    wallet_address: str, 
    signature: str, 
    message: str, 
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user)
):
    # 1. Verify the signature to prove they own the wallet they are linking
    if not verify_solana_signature(wallet_address, signature, message):
        raise HTTPException(status_code=400, detail="Invalid wallet signature")

    # 2. Link this wallet to the logged-in GitHub user
    query = update(Contributor).where(Contributor.id == int(current_user_id)).values(
        wallet_address=wallet_address
    )
    await db.execute(query)
    await db.commit()
    
    return {"status": "success", "linked_wallet": wallet_address}
