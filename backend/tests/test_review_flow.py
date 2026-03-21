"""Tests for bounty completion & review flow (Issue #191)."""
import pytest
from datetime import datetime, timedelta, timezone
from app.models.bounty import BountyCreate, BountyStatus, SubmissionCreate, SubmissionStatus
from app.services import bounty_service
from app.services.bounty_service import _bounty_store
from app.services.payout_service import reset_stores as rp
from app.services.review_flow_service import (
    AlreadyDisputedError, BountyNotFoundError, CreatorDecision as CA,
    CreatorDecisionRequest as CDR, DuplicateReviewError, InvalidStateTransitionError as IST,
    ReviewScoreCreate as RSC, SubmissionNotFoundError as SNF, TIER_SCORE_THRESHOLDS as TST,
    UnauthorizedApprovalError, VALID_REVIEW_MODELS as VRM, _auto_approve_timers, _lock,
    check_auto_approve, creator_decision as cd, get_completion_state as gcs,
    get_lifecycle_events as gle, get_review_summary as grs, record_review_score as rrs,
    reset_stores as rs, submit_for_review as sfr)

C="97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF";W="BSz85f6tVkjXfLqBBXi9EYv2q3dqZ77UHn1xkRkJLmqa"
PR="https://github.com/SolFoundry/solfoundry/pull/999";AP=CA.APPROVE;DP=CA.DISPUTE

@pytest.fixture(autouse=True)
    """The _c function."""
def _c(): _bounty_store.clear();rs();rp();yield;_bounty_store.clear();rs();rp()

    """The _b function."""
def _b(t=2): return _bounty_store[(bounty_service.create_bounty(BountyCreate(title="Test Bounty",description="D",tier=t,reward_amount=500000,created_by=C))).id]
def _s(b):
    """The _s function."""
    r,e=bounty_service.submit_solution(b.id,SubmissionCreate(pr_url=PR,submitted_by=W));assert not e
    return next(s for s in b.submissions if s.id==r.id)
def _a(bid,sid,sc=8.5):
    """The _a function."""
    for m in sorted(VRM): s=rrs(bid,sid,RSC(model=m,overall_score=sc))
    return s

    """The test_submit function."""
def test_submit(): b=_b();s=_s(b);sfr(b.id,s.id,W);assert b.status==BountyStatus.UNDER_REVIEW
    """The test_submit_bad function."""
def test_submit_bad(): pytest.raises(BountyNotFoundError,sfr,"x","x",W)
    """The test_submit_bad_sub function."""
def test_submit_bad_sub(): pytest.raises(SNF,sfr,_b().id,"x",W)
def test_submit_completed():
    """The test_submit_completed function."""
    b=_b();s=_s(b);b.status=BountyStatus.COMPLETED;pytest.raises(IST,sfr,b.id,s.id,W)
def test_submit_lifecycle():
    """The test_submit_lifecycle function."""
    b=_b();s=_s(b);sfr(b.id,s.id,W);assert any(e.event_type=="submission_entered_review" for e in gle(b.id))
    """The test_score function."""
def test_score(): b=_b();s=_s(b);assert rrs(b.id,s.id,RSC(model="gpt",overall_score=8)).overall_average==8.0
    """The test_all_auto function."""
def test_all_auto(): b=_b();s=_s(b);r=_a(b.id,s.id,8.5);assert r.auto_approve_eligible
    """The test_below function."""
def test_below(): b=_b();s=_s(b);assert not _a(b.id,s.id,5).meets_threshold
def test_dup():
    """The test_dup function."""
    b=_b();s=_s(b);rrs(b.id,s.id,RSC(model="gpt",overall_score=8));pytest.raises(DuplicateReviewError,rrs,b.id,s.id,RSC(model="gpt",overall_score=9))
    """The test_bad_model function."""
def test_bad_model(): pytest.raises(ValueError,RSC,model="claude",overall_score=8)
def test_ai_update():
    """The test_ai_update function."""
    b=_b();s=_s(b);rrs(b.id,s.id,RSC(model="gpt",overall_score=7));rrs(b.id,s.id,RSC(model="gemini",overall_score=9));assert s.ai_score==8.0
def test_tiers():
    """The test_tiers function."""
    for t,th in TST.items():
        _bounty_store.clear();rs();rp();b=_b(t);s=_s(b);assert not _a(b.id,s.id,th-0.1).meets_threshold
def test_categories():
    """The test_categories function."""
    b=_b();s=_s(b);r=rrs(b.id,s.id,RSC(model="gpt",overall_score=8.5,categories=[{"name":"quality","score":9,"feedback":"ok"}]))
    assert r.scores[0].categories[0].name=="quality"
    """The test_summary function."""
def test_summary(): b=_b();s=_s(b);assert grs(b.id,s.id).overall_average==0.0
def test_summary2():
    """The test_summary2 function."""
    b=_b();s=_s(b);rrs(b.id,s.id,RSC(model="gpt",overall_score=7));rrs(b.id,s.id,RSC(model="gemini",overall_score=9))
    assert grs(b.id,s.id).overall_average==8.0
def test_approve():
    """The test_approve function."""
    b=_b();s=_s(b);_a(b.id,s.id);c=cd(b.id,s.id,C,CDR(decision=AP));assert c.winner_wallet==W and b.status==BountyStatus.PAID
    """The test_unauth function."""
def test_unauth(): b=_b();s=_s(b);pytest.raises(UnauthorizedApprovalError,cd,b.id,s.id,"x",CDR(decision=AP))
    """The test_completion function."""
def test_completion(): b=_b();s=_s(b);cd(b.id,s.id,C,CDR(decision=AP));assert gcs(b.id) is not None
def test_approve_events():
    """The test_approve_events function."""
    b=_b();s=_s(b);cd(b.id,s.id,C,CDR(decision=AP));t=[e.event_type for e in gle(b.id)]
    assert "submission_approved" in t and "payout_released" in t
def test_dispute():
    """The test_dispute function."""
    b=_b();s=_s(b);cd(b.id,s.id,C,CDR(decision=DP,notes="bad"))
    assert s.status==SubmissionStatus.DISPUTED and b.status==BountyStatus.DISPUTED
def test_dispute_timer():
    """The test_dispute_timer function."""
    b=_b();s=_s(b);_a(b.id,s.id,9)
    with _lock:assert s.id in _auto_approve_timers
    cd(b.id,s.id,C,CDR(decision=DP,notes="x"))
    with _lock:assert s.id not in _auto_approve_timers
def test_dbl_dispute():
    """The test_dbl_dispute function."""
    b=_b();s=_s(b);cd(b.id,s.id,C,CDR(decision=DP,notes="1"));pytest.raises(AlreadyDisputedError,cd,b.id,s.id,C,CDR(decision=DP,notes="2"))
    """The test_auto_before function."""
def test_auto_before(): b=_b();s=_s(b);_a(b.id,s.id,9);assert check_auto_approve(b.id,s.id) is None
def test_auto_after():
    """The test_auto_after function."""
    b=_b();s=_s(b);_a(b.id,s.id,9)
    with _lock:_auto_approve_timers[s.id]=datetime.now(timezone.utc)-timedelta(hours=1)
    assert check_auto_approve(b.id,s.id).winner_wallet==W
def test_auto_skip():
    """The test_auto_skip function."""
    b=_b();s=_s(b);_a(b.id,s.id,9);cd(b.id,s.id,C,CDR(decision=DP,notes="x"));assert check_auto_approve(b.id,s.id) is None
    """The test_no_comp function."""
def test_no_comp(): b=_b();_s(b);assert gcs(b.id) is None
def test_comp_payout():
    """The test_comp_payout function."""
    b=_b();s=_s(b);cd(b.id,s.id,C,CDR(decision=AP));assert "solscan.io" in gcs(b.id).payout_solscan_url
def test_comp_review():
    """The test_comp_review function."""
    b=_b();s=_s(b);_a(b.id,s.id,8.0);cd(b.id,s.id,C,CDR(decision=AP));assert gcs(b.id).review_summary.overall_average==8.0
def test_full():
    """The test_full function."""
    b=_b();s=_s(b);sfr(b.id,s.id,W);_a(b.id,s.id,8.5);cd(b.id,s.id,C,CDR(decision=AP))
    t=[e.event_type for e in gle(b.id)];assert "submission_entered_review" in t and "payout_released" in t
def test_paid_reapprove():
    """The test_paid_reapprove function."""
    b=_b();s=_s(b);cd(b.id,s.id,C,CDR(decision=AP));b.status=BountyStatus.UNDER_REVIEW;pytest.raises(IST,cd,b.id,s.id,C,CDR(decision=AP))
def test_reset():
    """The test_reset function."""
    b=_b();s=_s(b);_a(b.id,s.id);rs();assert grs(b.id,s.id).scores==[] and gle(b.id)==[]
