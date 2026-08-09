import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class RepoListing(Base):
    __tablename__ = "repo_listings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repo_url: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    owner: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(128), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String(64), index=True)
    stars: Mapped[int] = mapped_column(default=0)
    topics: Mapped[list] = mapped_column(JSONB, default=list)
    funding_goals: Mapped[list["FundingGoal"]] = relationship(
        back_populates="repo_listing",
        cascade="all, delete-orphan",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class FundingGoal(Base):
    __tablename__ = "funding_goals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repo_listing_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repo_listings.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    target_amount: Mapped[float] = mapped_column(Numeric(20, 2))
    raised_amount: Mapped[float] = mapped_column(Numeric(20, 2), default=0)
    currency: Mapped[str] = mapped_column(String(16), default="FNDRY")
    status: Mapped[str] = mapped_column(String(16), default="active", index=True)
    deadline: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    repo_listing: Mapped[RepoListing] = relationship(back_populates="funding_goals")
    contributions: Mapped[list["Contribution"]] = relationship(
        back_populates="funding_goal",
        cascade="all, delete-orphan",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Contribution(Base):
    __tablename__ = "contributions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    funding_goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("funding_goals.id", ondelete="CASCADE"), index=True
    )
    contributor_address: Mapped[str] = mapped_column(String(96), index=True)
    amount: Mapped[float] = mapped_column(Numeric(20, 2))
    currency: Mapped[str] = mapped_column(String(16), default="FNDRY")
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    transaction_signature: Mapped[str | None] = mapped_column(String(128), nullable=True)

    funding_goal: Mapped[FundingGoal] = relationship(back_populates="contributions")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Distribution(Base):
    __tablename__ = "distributions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    funding_goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("funding_goals.id", ondelete="CASCADE"), index=True
    )
    recipient_address: Mapped[str] = mapped_column(String(96), index=True)
    amount: Mapped[float] = mapped_column(Numeric(20, 2))
    currency: Mapped[str] = mapped_column(String(16), default="FNDRY")
    milestone: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    transaction_signature: Mapped[str | None] = mapped_column(String(128), nullable=True)

    funding_goal: Mapped[FundingGoal] = relationship()
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())