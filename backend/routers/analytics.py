"""Bounty analytics API — seed data until wired to solfoundry-api."""

from __future__ import annotations

import csv
import io
from datetime import date, timedelta
from typing import List

from fastapi import APIRouter
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from fpdf import FPDF

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _series_dates(days: int = 28) -> List[date]:
    end = date.today()
    return [end - timedelta(days=i) for i in range(days - 1, -1, -1)]


def seed_bounty_volume() -> List[dict]:
    out = []
    for i, d in enumerate(_series_dates(28)):
        # Simple wave + drift for plausible chart
        base = 12 + (i % 7) * 2 + (i // 7)
        out.append({"date": d.isoformat(), "count": base})
    return out


def seed_payouts() -> List[dict]:
    out = []
    for i, d in enumerate(_series_dates(28)):
        amount = 1500.0 + i * 120.5 + (i % 5) * 200.0
        out.append({"date": d.isoformat(), "amountUsd": round(amount, 2)})
    return out


class WeeklyGrowth(BaseModel):
    week_start: str
    new_contributors: int


class ContributorAnalytics(BaseModel):
    new_contributors_last_30d: int = Field(..., ge=0)
    active_contributors_last_30d: int = Field(..., ge=0)
    retention_rate: float = Field(..., ge=0.0, le=1.0, description="Fraction retained vs prior period")
    weekly_growth: List[WeeklyGrowth]


def seed_contributors() -> ContributorAnalytics:
    return ContributorAnalytics(
        new_contributors_last_30d=47,
        active_contributors_last_30d=312,
        retention_rate=0.72,
        weekly_growth=[
            WeeklyGrowth(week_start="2026-03-10", new_contributors=8),
            WeeklyGrowth(week_start="2026-03-17", new_contributors=11),
            WeeklyGrowth(week_start="2026-03-24", new_contributors=9),
            WeeklyGrowth(week_start="2026-03-31", new_contributors=14),
        ],
    )


@router.get("/bounty-volume", response_model=List[dict])
def get_bounty_volume() -> List[dict]:
    return seed_bounty_volume()


@router.get("/payouts", response_model=List[dict])
def get_payouts() -> List[dict]:
    return seed_payouts()


@router.get("/contributors", response_model=ContributorAnalytics)
def get_contributors() -> ContributorAnalytics:
    return seed_contributors()


@router.get("/reports/export.csv")
def export_csv() -> StreamingResponse:
    vol = seed_bounty_volume()
    pay = seed_payouts()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["section", "date", "metric", "value"])
    for row in vol:
        w.writerow(["bounty_volume", row["date"], "count", row["count"]])
    for row in pay:
        w.writerow(["payouts", row["date"], "amount_usd", row["amountUsd"]])
    c = seed_contributors()
    w.writerow(["summary", "", "new_contributors_30d", c.new_contributors_last_30d])
    w.writerow(["summary", "", "active_contributors_30d", c.active_contributors_last_30d])
    w.writerow(["summary", "", "retention_rate", c.retention_rate])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="bounty-analytics-report.csv"',
        },
    )


@router.get("/reports/export.pdf")
def export_pdf() -> Response:
    vol = seed_bounty_volume()
    pay = seed_payouts()
    c = seed_contributors()

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "SolFoundry - Bounty analytics report", ln=True)
    pdf.set_font("Helvetica", size=11)
    pdf.cell(0, 8, f"New contributors (30d): {c.new_contributors_last_30d}", ln=True)
    pdf.cell(0, 8, f"Active contributors (30d): {c.active_contributors_last_30d}", ln=True)
    pdf.cell(0, 8, f"Retention rate: {c.retention_rate:.0%}", ln=True)
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Recent bounty volume (last 7 days)", ln=True)
    pdf.set_font("Helvetica", size=10)
    for row in vol[-7:]:
        pdf.cell(0, 6, f"  {row['date']}: {row['count']} bounties", ln=True)
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Recent payouts (USD, last 7 days)", ln=True)
    pdf.set_font("Helvetica", size=10)
    for row in pay[-7:]:
        pdf.cell(0, 6, f"  {row['date']}: ${row['amountUsd']:,.2f}", ln=True)

    raw = pdf.output(dest="S")
    if isinstance(raw, str):
        body = raw.encode("latin-1")
    elif isinstance(raw, (bytes, bytearray)):
        body = bytes(raw)
    else:
        body = bytes(raw)
    return Response(
        content=body,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="bounty-analytics-report.pdf"',
        },
    )
