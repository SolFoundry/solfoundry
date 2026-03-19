from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional
from decimal import Decimal


class PayoutHistoryItem(BaseModel):
    id: str = Field(..., description="Unique identifier for the payout")
    date: datetime = Field(..., description="Date of the payout")
    amount: Decimal = Field(..., description="Amount paid out in USDC")
    transaction_hash: str = Field(..., description="Blockchain transaction hash")
    recipient_count: int = Field(..., description="Number of recipients")
    payout_type: str = Field(..., description="Type of payout (weekly, bonus, etc.)")
    status: str = Field(..., description="Status of the payout")


class PayoutHistoryResponse(BaseModel):
    payouts: List[PayoutHistoryItem]
    total_count: int = Field(..., description="Total number of payouts")
    total_amount: Decimal = Field(..., description="Total amount paid out")
    page: int = Field(default=1, description="Current page number")
    per_page: int = Field(default=10, description="Items per page")
    has_next: bool = Field(default=False, description="Whether there are more pages")


class TreasuryStats(BaseModel):
    total_balance: Decimal = Field(..., description="Total treasury balance in USDC")
    circulating_supply: Decimal = Field(..., description="Circulating supply of WORK tokens")
    total_supply: Decimal = Field(..., description="Total supply of WORK tokens")
    treasury_ratio: Decimal = Field(..., description="Treasury to circulating supply ratio")
    backing_per_token: Decimal = Field(..., description="USDC backing per WORK token")
    last_updated: datetime = Field(..., description="Last update timestamp")


class BuybackData(BaseModel):
    total_buybacks: Decimal = Field(..., description="Total amount bought back in USDC")
    tokens_burned: Decimal = Field(..., description="Total tokens burned")
    average_buyback_price: Decimal = Field(..., description="Average buyback price")
    last_buyback_date: Optional[datetime] = Field(None, description="Date of last buyback")
    buyback_count: int = Field(..., description="Number of buyback transactions")


class TokenomicsMetrics(BaseModel):
    market_cap: Decimal = Field(..., description="Current market cap")
    price: Decimal = Field(..., description="Current token price")
    volume_24h: Decimal = Field(..., description="24h trading volume")
    price_change_24h: Decimal = Field(..., description="24h price change percentage")
    all_time_high: Decimal = Field(..., description="All time high price")
    all_time_low: Decimal = Field(..., description="All time low price")


class TokenomicsResponse(BaseModel):
    treasury_stats: TreasuryStats
    buyback_data: BuybackData
    tokenomics_metrics: TokenomicsMetrics
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Response timestamp")