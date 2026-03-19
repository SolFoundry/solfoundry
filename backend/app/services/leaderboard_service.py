"""Leaderboard business logic."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.leaderboard import (
    Contributor,
    Contribution,
    ContributorBrief,
    ContributorDetail,
    ContributionDetail,
    LeaderboardResponse,
    SortField,
    TimeFilter,
)


def _time_cutoff(time_filter: TimeFilter) -> Optional[datetime]:
    now = datetime.now(timezone.utc)
    if time_filter == TimeFilter.weekly:
        return now - timedelta(weeks=1)
    if time_filter == TimeFilter.monthly:
        return now - timedelta(days=30)
    return None  # all_time


def _sort_column(field: SortField):
    return {
        SortField.rank: Contributor.rank,
        SortField.contributions: Contributor.total_contributions,
        SortField.earnings: Contributor.total_earnings,
    }[field]


def get_leaderboard(
    db: Session,
    *,
    page: int = 1,
    limit: int = 20,
    sort: SortField = SortField.rank,
    time_filter: TimeFilter = TimeFilter.all_time,
) -> LeaderboardResponse:
    # Base query filtered by time
    cutoff = _time_cutoff(time_filter)
    if cutoff is not None:
        # For time-filtered views, compute contributions in that window
        sub = (
            select(
                Contribution.contributor_id,
                func.count().label("total_contributions"),
                func.coalesce(func.sum(Contribution.amount), 0).label("total_earnings"),
            )
            .where(Contribution.created_at >= cutoff)
            .group_by(Contribution.contributor_id)
            .subquery()
        )
        query = (
            select(Contributor, sub.c.total_contributions, sub.c.total_earnings)
            .join(sub, Contributor.id == sub.c.contributor_id)
        )
        count_q = select(func.count()).select_from(sub)
        total = db.scalar(count_q) or 0
    else:
        query = select(Contributor)
        total = db.scalar(select(func.count()).select_from(Contributor)) or 0

    # Sorting
    if cutoff is not None:
        sort_map = {
            SortField.rank: Contributor.rank,
            SortField.contributions: sub.c.total_contributions,
            SortField.earnings: sub.c.total_earnings,
        }
    else:
        sort_map = {
            SortField.rank: Contributor.rank,
            SortField.contributions: Contributor.total_contributions,
            SortField.earnings: Contributor.total_earnings,
        }
    query = query.order_by(sort_map[sort].desc())

    # Pagination
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
    rows = db.execute(query).all()

    items = []
    for row in rows:
        if cutoff is not None:
            c, tc, te = row[0], row[1], row[2]
            items.append(ContributorBrief(
                id=c.id,
                wallet_address=c.wallet_address,
                display_name=c.display_name,
                avatar_url=c.avatar_url,
                total_contributions=tc,
                total_earnings=te,
                rank=c.rank,
            ))
        else:
            c = row[0] if isinstance(row, tuple) else row
            items.append(ContributorBrief.model_validate(c))

    pages = (total + limit - 1) // limit if total > 0 else 0

    return LeaderboardResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


def get_contributor_detail(db: Session, contributor_id: int) -> Optional[ContributorDetail]:
    contributor = db.scalar(
        select(Contributor).where(Contributor.id == contributor_id)
    )
    if not contributor:
        return None

    contribs = [
        ContributionDetail.model_validate(c)
        for c in db.scalars(
            select(Contribution)
            .where(Contribution.contributor_id == contributor_id)
            .order_by(desc(Contribution.created_at))
            .limit(50)
        ).all()
    ]

    return ContributorDetail(
        id=contributor.id,
        wallet_address=contributor.wallet_address,
        display_name=contributor.display_name,
        avatar_url=contributor.avatar_url,
        total_contributions=contributor.total_contributions,
        total_earnings=contributor.total_earnings,
        rank=contributor.rank,
        contributions=contribs,
    )
