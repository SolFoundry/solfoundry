"""Bounty review flow — submission to payout lifecycle (Closes #191)."""
from __future__ import annotations
import asyncio,hashlib,logging,threading,uuid
from datetime import datetime,timedelta,timezone
from enum import Enum
from typing import Any,Optional
from pydantic import BaseModel,Field,field_validator
from app.core.audit import audit_event
from app.models.bounty import BountyStatus as BS,SubmissionStatus as SS,VALID_SUBMISSION_TRANSITIONS as VST
from app.models.payout import PayoutCreate
from app.services.bounty_service import _bounty_store
from app.services.payout_service import create_payout
_L=logging.getLogger(__name__)
AUTO_APPROVE_DELAY_HOURS=48
TST={1:6.0,2:7.0,3:8.0}
TIER_SCORE_THRESHOLDS=TST
VALID_REVIEW_MODELS=frozenset({"gpt","gemini","grok"})
_now=lambda:datetime.now(timezone.utc);_uid=lambda:str(uuid.uuid4())
class ReviewFlowError(Exception):"""Base."""
class SubmissionNotFoundError(ReviewFlowError):"""Not found."""
class BountyNotFoundError(ReviewFlowError):"""Not found."""
class DuplicateReviewError(ReviewFlowError):"""Dup."""
class InvalidStateTransitionError(ReviewFlowError):"""Bad state."""
class AlreadyDisputedError(ReviewFlowError):"""Disputed."""
class UnauthorizedApprovalError(ReviewFlowError):"""Unauth."""
class InsufficientReviewError(ReviewFlowError):"""Incomplete."""
def _vm(v):
    """Validate model."""
    n=v.strip().lower()
    if n not in VALID_REVIEW_MODELS:raise ValueError(f"Invalid model '{v}'")
    return n
class ReviewScoreCategory(BaseModel):
    """Category."""
    name:str=Field(...,min_length=1,max_length=100);score:float=Field(...,ge=0,le=10);feedback:str=Field("",max_length=2000)
class ReviewScore(BaseModel):
    """AI score."""
    id:str=Field(default_factory=_uid);submission_id:str;model:str;overall_score:float=Field(...,ge=0,le=10);categories:list[ReviewScoreCategory]=Field(default_factory=list);created_at:datetime=Field(default_factory=_now)
    @field_validator("model")
    @classmethod
    def vm(cls,v):
        """Validate."""
        return _vm(v)
class ReviewScoreCreate(BaseModel):
    """Input."""
    model:str=Field(...,min_length=1);overall_score:float=Field(...,ge=0,le=10);categories:list[ReviewScoreCategory]=Field(default_factory=list)
    @field_validator("model")
    @classmethod
    def vm(cls,v):
        """Validate."""
        return _vm(v)
class ReviewSummary(BaseModel):
    """Summary."""
    submission_id:str;scores:list[ReviewScore]=Field(default_factory=list);overall_average:float=0.0;models_reviewed:list[str]=Field(default_factory=list);meets_threshold:bool=False;threshold:float=0.0;auto_approve_eligible:bool=False;auto_approve_at:Optional[datetime]=None
class LifecycleEvent(BaseModel):
    """Event."""
    id:str=Field(default_factory=_uid);bounty_id:str;event_type:str;actor:str="system";metadata:dict[str,Any]=Field(default_factory=dict);created_at:datetime=Field(default_factory=_now)
class CompletionState(BaseModel):
    """Done."""
    bounty_id:str;winner_wallet:Optional[str]=None;winner_username:Optional[str]=None;winning_submission_id:Optional[str]=None;payout_tx_hash:Optional[str]=None;payout_amount:Optional[float]=None;payout_solscan_url:Optional[str]=None;review_summary:Optional[ReviewSummary]=None;completed_at:Optional[datetime]=None
class CreatorDecision(str,Enum):
    """Decision."""
    APPROVE="approve";DISPUTE="dispute"
class CreatorDecisionRequest(BaseModel):
    """Request."""
    decision:CreatorDecision;notes:str=Field("",max_length=2000)
_lock=threading.Lock();_scores={};_events={};_completions={};_aat={};_notifications=[]
_B58="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
def _get(bid,sid):
    """Lookup."""
    b=_bounty_store.get(bid)
    if not b:raise BountyNotFoundError(bid)
    for s in b.submissions:
        if s.id==sid:return b,s
    raise SubmissionNotFoundError(sid)
def _log(bid,et,actor="system",**m):
    """Log."""
    with _lock:_events.setdefault(bid,[]).append(LifecycleEvent(bounty_id=bid,event_type=et,actor=actor,metadata=m))
    audit_event(et,bounty_id=bid,actor=actor,**m)
def _nfy(r,et,bid,msg,**m):
    """Notify."""
    with _lock:_notifications.append({"recipient":r,"event_type":et,"bounty_id":bid,"message":msg,**m})
_avg=lambda sc:round(sum(s.overall_score for s in sc)/len(sc),2)if sc else 0.0
_tv=lambda b:b.tier if isinstance(b.tier,int)else b.tier.value
def _summ(b,sid,sc,aa=None):
    """Build summary."""
    t=TST.get(_tv(b),7.0);a=_avg(sc);m=a>=t
    return ReviewSummary(submission_id=sid,scores=sc,overall_average=a,models_reviewed=[s.model for s in sc],meets_threshold=m,threshold=t,auto_approve_eligible=m and len(sc)>=len(VALID_REVIEW_MODELS),auto_approve_at=aa)
def submit_for_review(bid,sid,wallet):
    """Submit for review."""
    b,s=_get(bid,sid)
    with _lock:
        if b.status not in(BS.OPEN,BS.IN_PROGRESS):raise InvalidStateTransitionError(b.status.value)
        b.status=BS.UNDER_REVIEW;b.updated_at=_now()
    _log(bid,"submission_entered_review",actor=wallet,submission_id=sid)
    _nfy(b.created_by,"submission_entered_review",bid,f"New sub for '{b.title}'")
    return ReviewSummary(submission_id=sid,threshold=TST.get(_tv(b),7.0))
def record_review_score(bid,sid,data):
    """Record AI score, start 48h timer when all pass."""
    b,s=_get(bid,sid);ns=ReviewScore(submission_id=sid,model=data.model,overall_score=data.overall_score,categories=data.categories)
    with _lock:
        for sc in _scores.get(sid,[]):
            if sc.model==data.model:raise DuplicateReviewError(data.model)
        _scores.setdefault(sid,[]).append(ns);snap=list(_scores[sid])
    _log(bid,"review_score_recorded",actor=f"ai:{data.model}",submission_id=sid,score=data.overall_score)
    t=TST.get(_tv(b),7.0);av=_avg(snap);meets=av>=t;aa_at,el=None,False
    if meets and len(snap)>=len(VALID_REVIEW_MODELS):
        el=True
        with _lock:
            if sid not in _aat:_aat[sid]=_now()+timedelta(hours=AUTO_APPROVE_DELAY_HOURS)
            aa_at=_aat[sid]
        _log(bid,"auto_approve_timer_started",submission_id=sid);_nfy(b.created_by,"review_scores_complete",bid,f"AI avg {av}/10")
    s.ai_score=av
    return ReviewSummary(submission_id=sid,scores=snap,overall_average=av,models_reviewed=[x.model for x in snap],meets_threshold=meets,threshold=t,auto_approve_eligible=el,auto_approve_at=aa_at)
def get_review_summary(bid,sid):
    """Summary."""
    b,_=_get(bid,sid)
    with _lock:snap=list(_scores.get(sid,[]));aa=_aat.get(sid)
    return _summ(b,sid,snap,aa)
def creator_decision(bid,sid,cid,req):
    """Creator approve or dispute."""
    b,s=_get(bid,sid)
    if b.created_by!=cid:raise UnauthorizedApprovalError(cid)
    if req.decision==CreatorDecision.APPROVE:
        with _lock:n=len(_scores.get(sid,[]))
        if n<len(VALID_REVIEW_MODELS):raise InsufficientReviewError(f"{n}/{len(VALID_REVIEW_MODELS)}")
        return _approve(b,s,cid,req.notes)
    return _dispute(b,s,cid,req.notes)
def check_auto_approve(bid,sid):
    """Check 48h auto-approve."""
    b,s=_get(bid,sid)
    with _lock:
        dl=_aat.get(sid)
        if not dl or _now()<dl:return None
        if s.status in(SS.APPROVED,SS.PAID):return _completions.get(bid)
        if s.status==SS.DISPUTED:return None
    _log(bid,"auto_approved",submission_id=sid);return _approve(b,s,"system","Auto-approved")
def get_completion_state(bid):
    """Completion."""
    with _lock:return _completions.get(bid)
def get_lifecycle_events(bid):
    """Events."""
    with _lock:return list(_events.get(bid,[]))
def get_notifications(recipient=None):
    """Notifications."""
    with _lock:return[n for n in _notifications if n["recipient"]==recipient]if recipient else list(_notifications)
def _approve(b,s,actor,notes):
    """Approve+payout."""
    with _lock:
        if SS.APPROVED not in VST.get(s.status,set())and s.status!=SS.APPROVED:raise InvalidStateTransitionError(s.status.value)
        s.status=SS.APPROVED;b.status=BS.COMPLETED;b.updated_at=_now()
    _log(b.id,"submission_approved",actor=actor,submission_id=s.id,notes=notes)
    tx="".join(_B58[x%len(_B58)]for x in hashlib.sha256(uuid.uuid4().bytes).digest()).ljust(88,_B58[0])[:88]
    create_payout(PayoutCreate(recipient=s.submitted_by,amount=b.reward_amount,token="FNDRY",bounty_id=b.id,bounty_title=b.title,tx_hash=tx))
    with _lock:s.status=SS.PAID;b.status=BS.PAID;b.updated_at=_now()
    _log(b.id,"payout_released",actor="escrow_service",submission_id=s.id,tx_hash=tx,amount=b.reward_amount)
    snap=list(_scores.get(s.id,[]))
    cs=CompletionState(bounty_id=b.id,winner_wallet=s.submitted_by,winner_username=s.submitted_by,winning_submission_id=s.id,payout_tx_hash=tx,payout_amount=b.reward_amount,payout_solscan_url=f"https://solscan.io/tx/{tx}",review_summary=_summ(b,s.id,snap),completed_at=_now())
    with _lock:_completions[b.id]=cs;_aat.pop(s.id,None)
    _nfy(s.submitted_by,"submission_approved",b.id,f"Approved! {b.reward_amount} FNDRY.");_nfy(b.created_by,"bounty_completed",b.id,"Done.");return cs
def _dispute(b,s,actor,notes):
    """Dispute."""
    with _lock:
        if s.status==SS.DISPUTED:raise AlreadyDisputedError(s.id)
        if SS.DISPUTED not in VST.get(s.status,set()):raise InvalidStateTransitionError(s.status.value)
        s.status=SS.DISPUTED;b.status=BS.DISPUTED;b.updated_at=_now();_aat.pop(s.id,None)
    _log(b.id,"submission_disputed",actor=actor,submission_id=s.id,notes=notes)
    _nfy(s.submitted_by,"submission_disputed",b.id,"Disputed.",notes=notes);return CompletionState(bounty_id=b.id)
async def auto_approve_background_task():
    """Poll for expired 48h deadlines."""
    _L.info("Auto-approve poller started")
    while True:
        try:
            await asyncio.sleep(60)
            with _lock:pending=list(_aat.items())
            for sid,dl in pending:
                if _now()<dl:continue
                bid=next((i for i,b in _bounty_store.items()if any(x.id==sid for x in b.submissions)),None)
                if bid:
                    try:await asyncio.to_thread(check_auto_approve,bid,sid)
                    except ReviewFlowError as e:_L.warning("Auto-approve %s: %s",sid,e)
        except asyncio.CancelledError:break
        except Exception as e:_L.error("Auto-approve: %s",e,exc_info=True)
def reset_stores():
    """Clear."""
    with _lock:_scores.clear();_events.clear();_completions.clear();_aat.clear();_notifications.clear()
