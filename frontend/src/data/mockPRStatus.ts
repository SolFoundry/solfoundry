/** @module mockPRStatus - Mock data for PR tracker. */
import type { PRStatus, PipelineStage, AIScore } from '../types/prStatus';
/* eslint-disable @typescript-eslint/no-explicit-any */
const g=(n:string,l:string,st:string,o:any={}):PipelineStage=>({name:n as any,label:l,status:st as any,...o});
const sc=(c:string,n:number,d?:string):AIScore=>({category:c as any,label:c[0].toUpperCase()+c.slice(1),score:n,maxScore:100,...(d?{details:d}:{})});
const pr=(id:string,n:number,t:string,repo:string,bid:string,o:string,ss:PipelineStage[]):PRStatus=>({id,prNumber:n,prTitle:t,prUrl:`https://github.com/solfoundry/${repo}/pull/${n}`,repositoryName:`solfoundry/${repo}`,bountyId:bid,bountyTitle:t,contributorAddress:id,outcome:o as any,stages:ss});

/** Completed PR that reached payout. */
export const mockPRStatusCompleted=pr('prs-001',142,'feat: add dark mode to docs site','docs','b-003','paid',[
  g('submitted','Submitted','pass',{startedAt:'2026-03-15T10:00:00Z',completedAt:'2026-03-15T10:00:05Z',details:'PR #142 opened'}),
  g('ci_running','CI Running','pass',{startedAt:'2026-03-15T10:00:10Z',completedAt:'2026-03-15T10:12:34Z'}),
  g('ai_review','AI Review','pass',{startedAt:'2026-03-15T10:12:40Z',completedAt:'2026-03-15T10:14:22Z',
    aiReview:{overallScore:87,maxScore:100,passed:true,scores:[sc('quality',90),sc('correctness',85),sc('security',92),sc('completeness',80),sc('tests',88)]}}),
  g('human_review','Human Review','pass'),g('approved','Approved','pass'),g('denied','Denied','skipped'),
  g('payout','Payout','pass',{payout:{amount:500,currency:'USDC',txHash:'4vJ9JU1bJJE96FWSJKvHsmmFADCg',network:'mainnet-beta',paidAt:'2026-03-15T14:31:12Z'}}),
]);
/** PR in AI review (running/pending states). */
export const mockPRStatusInReview=pr('prs-002',156,'fix: wallet timeout','app','b-007','in_progress',[
  g('submitted','Submitted','pass'),g('ci_running','CI Running','pass'),g('ai_review','AI Review','running'),
  g('human_review','Human Review','pending'),g('approved','Approved','pending'),g('denied','Denied','pending'),g('payout','Payout','pending')]);
/** All mocks. */
export const mockPRStatuses: PRStatus[] = [mockPRStatusCompleted,mockPRStatusInReview];
