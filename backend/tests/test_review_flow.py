"""Tests for bounty review flow (#191)."""
import pytest
from datetime import datetime,timedelta,timezone
from app.models.bounty import BountyCreate,BountyStatus,SubmissionCreate,SubmissionStatus
from app.services import bounty_service as bs
from app.services.bounty_service import _bounty_store as st
from app.services.payout_service import reset_stores as rp
from app.services.review_flow_service import *
from app.services.review_flow_service import _aat,_lock,reset_stores as rr
CD=CreatorDecision;CDR=CreatorDecisionRequest;RSC=ReviewScoreCreate;IST=InvalidStateTransitionError;TST=TIER_SCORE_THRESHOLDS
C="97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF";W="BSz85f6tVkjXfLqBBXi9EYv2q3dqZ77UHn1xkRkJLmqa"
@pytest.fixture(autouse=True)
def clean():
    """Reset."""
    st.clear();rr();rp();yield;st.clear();rr();rp()
def _b(t=2):
    """Bounty."""
    return st[bs.create_bounty(BountyCreate(title="Tst",description="D",tier=t,reward_amount=500000,created_by=C)).id]
def _s(b):
    """Sub."""
    r,e=bs.submit_solution(b.id,SubmissionCreate(pr_url="https://github.com/SolFoundry/solfoundry/pull/99",submitted_by=W));assert not e
    return next(s for s in b.submissions if s.id==r.id)
def _a(bid,sid,sc=8.5):
    """Score all."""
    for m in sorted(VALID_REVIEW_MODELS):r=record_review_score(bid,sid,RSC(model=m,overall_score=sc))
    return r
def test_submit():
    """Submit enters review."""
    b=_b();s=_s(b);submit_for_review(b.id,s.id,W);assert b.status==BountyStatus.UNDER_REVIEW
    assert any(e.event_type=="submission_entered_review" for e in get_lifecycle_events(b.id))
    assert any(n["event_type"]=="submission_entered_review" for n in get_notifications(C))
def test_submit_errors():
    """Bad bounty/sub/completed."""
    pytest.raises(BountyNotFoundError,submit_for_review,"x","x",W);pytest.raises(SubmissionNotFoundError,submit_for_review,_b().id,"x",W)
    b=_b();s=_s(b);b.status=BountyStatus.COMPLETED;pytest.raises(IST,submit_for_review,b.id,s.id,W)
def test_scores_and_validation():
    """Single avg, eligible, below, dup, invalid, categories, ai_score."""
    b=_b();s=_s(b);assert record_review_score(b.id,s.id,RSC(model="gpt",overall_score=8)).overall_average==8.0
    pytest.raises(DuplicateReviewError,record_review_score,b.id,s.id,RSC(model="gpt",overall_score=9))
    pytest.raises(ValueError,RSC,model="claude",overall_score=8)
    record_review_score(b.id,s.id,RSC(model="gemini",overall_score=7.5));assert s.ai_score==round((8+7.5)/2,2)
    b2=_b();s2=_s(b2);assert _a(b2.id,s2.id,8.5).auto_approve_eligible
    b3=_b();s3=_s(b3);assert not _a(b3.id,s3.id,5).meets_threshold
    b4=_b();s4=_s(b4);r=record_review_score(b4.id,s4.id,RSC(model="gpt",overall_score=8.5,categories=[{"name":"q","score":9,"feedback":"ok"}]))
    assert r.scores[0].categories[0].name=="q"
@pytest.mark.parametrize("t,th",list(TST.items()))
def test_tiers(t,th):
    """Tier thresholds."""
    st.clear();rr();rp();b=_b(t);s=_s(b);assert not _a(b.id,s.id,th-0.1).meets_threshold
def test_summary():
    """Empty=0, multi=avg."""
    b=_b();s=_s(b);assert get_review_summary(b.id,s.id).overall_average==0.0
    record_review_score(b.id,s.id,RSC(model="gpt",overall_score=7));record_review_score(b.id,s.id,RSC(model="gemini",overall_score=9))
    assert get_review_summary(b.id,s.id).overall_average==8.0
def test_approve():
    """Approve->PAID, events, notifications, completion."""
    b=_b();s=_s(b);_a(b.id,s.id,8.0)
    r=creator_decision(b.id,s.id,C,CDR(decision=CD.APPROVE));assert r.winner_wallet==W and b.status==BountyStatus.PAID
    t=[e.event_type for e in get_lifecycle_events(b.id)];assert "submission_approved" in t and "payout_released" in t
    assert any(n["event_type"]=="submission_approved" for n in get_notifications(W))
    c=get_completion_state(b.id);assert c and "solscan.io" in c.payout_solscan_url and c.review_summary.overall_average==8.0
def test_approve_guards():
    """Needs all reviews, creator only."""
    b=_b();s=_s(b);record_review_score(b.id,s.id,RSC(model="gpt",overall_score=9))
    pytest.raises(InsufficientReviewError,creator_decision,b.id,s.id,C,CDR(decision=CD.APPROVE))
    pytest.raises(UnauthorizedApprovalError,creator_decision,b.id,s.id,"x",CDR(decision=CD.APPROVE))
def test_dispute():
    """Dispute+double+timer."""
    b=_b();s=_s(b);_a(b.id,s.id,9)
    with _lock:assert s.id in _aat
    creator_decision(b.id,s.id,C,CDR(decision=CD.DISPUTE,notes="Bad"))
    assert s.status==SubmissionStatus.DISPUTED and b.status==BountyStatus.DISPUTED
    with _lock:assert s.id not in _aat
    assert any(n["event_type"]=="submission_disputed" for n in get_notifications(W))
    pytest.raises(AlreadyDisputedError,creator_decision,b.id,s.id,C,CDR(decision=CD.DISPUTE,notes="2"))
def test_auto_approve():
    """Before=None, after=fires, disputed=skips."""
    b=_b();s=_s(b);_a(b.id,s.id,9);assert check_auto_approve(b.id,s.id) is None
    with _lock:_aat[s.id]=datetime.now(timezone.utc)-timedelta(hours=1)
    assert check_auto_approve(b.id,s.id).winner_wallet==W
    b2=_b();s2=_s(b2);_a(b2.id,s2.id,9);creator_decision(b2.id,s2.id,C,CDR(decision=CD.DISPUTE,notes="x"))
    assert check_auto_approve(b2.id,s2.id) is None
def test_full_and_reapprove():
    """Full lifecycle + paid blocks re-approve."""
    b=_b();s=_s(b);submit_for_review(b.id,s.id,W);_a(b.id,s.id,8.5)
    creator_decision(b.id,s.id,C,CDR(decision=CD.APPROVE))
    t=[e.event_type for e in get_lifecycle_events(b.id)];assert "submission_entered_review" in t and "payout_released" in t
    b.status=BountyStatus.UNDER_REVIEW;pytest.raises(IST,creator_decision,b.id,s.id,C,CDR(decision=CD.APPROVE))
def test_reset():
    """Reset clears."""
    b=_b();s=_s(b);_a(b.id,s.id);rr();assert get_review_summary(b.id,s.id).scores==[] and get_lifecycle_events(b.id)==[]
