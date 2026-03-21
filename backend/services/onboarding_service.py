from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from enum import Enum
import logging
from dataclasses import dataclass

from ..models.user import User
from ..models.bounty import Bounty
from ..repositories.user_repository import UserRepository
from ..repositories.bounty_repository import BountyRepository
from ..repositories.mentor_repository import MentorRepository
from ..config.database import get_db_session
from ..utils.exceptions import ValidationError, ServiceError

logger = logging.getLogger(__name__)


class OnboardingStage(Enum):
    REGISTRATION = "registration"
    SKILL_ASSESSMENT = "skill_assessment"
    BEGINNER_BOUNTIES = "beginner_bounties"
    MENTOR_MATCHING = "mentor_matching"
    FIRST_SUBMISSION = "first_submission"
    COMPLETED = "completed"


@dataclass
class SkillAssessment:
    programming_experience: str
    solana_knowledge: int
    preferred_languages: List[str]
    available_hours: int
    learning_goals: List[str]
    confidence_score: float


@dataclass
class MentorMatch:
    mentor_id: str
    compatibility_score: float
    shared_skills: List[str]
    availability_overlap: int
    experience_level: str


class OnboardingService:
    def __init__(self):
        self.user_repo = UserRepository()
        self.bounty_repo = BountyRepository()
        self.mentor_repo = MentorRepository()

    def get_user_stage(self, user_id: str) -> OnboardingStage:
        """Get current onboarding stage for user"""
        try:
            with get_db_session() as session:
                user = self.user_repo.get_by_id(session, user_id)
                if not user:
                    raise ValidationError("User not found")

                return OnboardingStage(user.onboarding_stage or "registration")
        except Exception as e:
            logger.error(f"Failed to get user stage: {str(e)}")
            raise ServiceError("Could not retrieve onboarding stage")

    def advance_stage(self, user_id: str, target_stage: OnboardingStage) -> bool:
        """Validate and advance user to next onboarding stage"""
        try:
            with get_db_session() as session:
                current_stage = self.get_user_stage(user_id)

                if not self._can_advance_to_stage(current_stage, target_stage):
                    raise ValidationError(f"Cannot advance from {current_stage.value} to {target_stage.value}")

                if not self._validate_stage_requirements(user_id, target_stage):
                    raise ValidationError(f"Requirements not met for {target_stage.value}")

                self.user_repo.update_onboarding_stage(session, user_id, target_stage.value)
                session.commit()

                logger.info(f"User {user_id} advanced to {target_stage.value}")
                return True

        except Exception as e:
            logger.error(f"Failed to advance stage: {str(e)}")
            raise

    def _can_advance_to_stage(self, current: OnboardingStage, target: OnboardingStage) -> bool:
        """Check if stage progression is valid"""
        stage_order = [
            OnboardingStage.REGISTRATION,
            OnboardingStage.SKILL_ASSESSMENT,
            OnboardingStage.BEGINNER_BOUNTIES,
            OnboardingStage.MENTOR_MATCHING,
            OnboardingStage.FIRST_SUBMISSION,
            OnboardingStage.COMPLETED
        ]

        current_idx = stage_order.index(current)
        target_idx = stage_order.index(target)

        return target_idx == current_idx + 1

    def _validate_stage_requirements(self, user_id: str, stage: OnboardingStage) -> bool:
        """Validate requirements for entering a stage"""
        if stage == OnboardingStage.SKILL_ASSESSMENT:
            return self._validate_registration_complete(user_id)
        elif stage == OnboardingStage.BEGINNER_BOUNTIES:
            return self._validate_assessment_complete(user_id)
        elif stage == OnboardingStage.MENTOR_MATCHING:
            return self._validate_bounty_engagement(user_id)
        elif stage == OnboardingStage.FIRST_SUBMISSION:
            return self._validate_mentor_assigned(user_id)
        elif stage == OnboardingStage.COMPLETED:
            return self._validate_submission_made(user_id)

        return True

    def process_skill_assessment(self, user_id: str, assessment_data: Dict[str, Any]) -> SkillAssessment:
        """Process and store skill assessment results"""
        try:
            assessment = SkillAssessment(
                programming_experience=assessment_data.get("programming_experience", "beginner"),
                solana_knowledge=assessment_data.get("solana_knowledge", 1),
                preferred_languages=assessment_data.get("preferred_languages", []),
                available_hours=assessment_data.get("available_hours", 5),
                learning_goals=assessment_data.get("learning_goals", []),
                confidence_score=self._calculate_confidence_score(assessment_data)
            )

            with get_db_session() as session:
                self.user_repo.update_skill_assessment(session, user_id, assessment.__dict__)
                session.commit()

            logger.info(f"Skill assessment processed for user {user_id}")
            return assessment

        except Exception as e:
            logger.error(f"Failed to process skill assessment: {str(e)}")
            raise ServiceError("Could not process skill assessment")

    def _calculate_confidence_score(self, assessment_data: Dict[str, Any]) -> float:
        """Calculate confidence score based on assessment responses"""
        score = 0.0

        exp_mapping = {
            "beginner": 0.2,
            "intermediate": 0.5,
            "advanced": 0.8,
            "expert": 1.0
        }

        score += exp_mapping.get(assessment_data.get("programming_experience", "beginner"), 0.2)
        score += min(assessment_data.get("solana_knowledge", 1) / 10, 0.3)
        score += min(len(assessment_data.get("preferred_languages", [])) / 5, 0.2)
        score += min(assessment_data.get("available_hours", 5) / 20, 0.3)

        return min(score, 1.0)

    def filter_beginner_bounties(self, user_id: str, bounties: List[Bounty]) -> List[Bounty]:
        """Filter bounties suitable for beginners based on skill assessment"""
        try:
            with get_db_session() as session:
                user = self.user_repo.get_by_id(session, user_id)
                if not user or not user.skill_assessment:
                    return []

                assessment = user.skill_assessment
                suitable_bounties = []

                for bounty in bounties:
                    if self._is_suitable_for_beginner(bounty, assessment):
                        suitable_bounties.append(bounty)

                # Sort by suitability score
                suitable_bounties.sort(key=lambda b: self._calculate_suitability_score(b, assessment), reverse=True)

                return suitable_bounties[:10]  # Return top 10

        except Exception as e:
            logger.error(f"Failed to filter beginner bounties: {str(e)}")
            return []

    def _is_suitable_for_beginner(self, bounty: Bounty, assessment: Dict[str, Any]) -> bool:
        """Check if bounty is suitable for beginner"""
        if bounty.difficulty_level not in ["beginner", "easy"]:
            return False

        if bounty.estimated_hours > assessment.get("available_hours", 5) * 2:
            return False

        required_skills = bounty.required_skills or []
        user_languages = assessment.get("preferred_languages", [])

        # Must have at least one matching skill/language
        return any(skill.lower() in [lang.lower() for lang in user_languages] for skill in required_skills)

    def _calculate_suitability_score(self, bounty: Bounty, assessment: Dict[str, Any]) -> float:
        """Calculate how suitable a bounty is for the user"""
        score = 0.0

        # Skill match
        required_skills = bounty.required_skills or []
        user_languages = assessment.get("preferred_languages", [])
        skill_matches = sum(1 for skill in required_skills if skill.lower() in [lang.lower() for lang in user_languages])
        score += (skill_matches / max(len(required_skills), 1)) * 0.4

        # Time availability
        available_hours = assessment.get("available_hours", 5)
        if bounty.estimated_hours <= available_hours:
            score += 0.3
        elif bounty.estimated_hours <= available_hours * 1.5:
            score += 0.2

        # Learning goal alignment
        learning_goals = assessment.get("learning_goals", [])
        if any(goal.lower() in bounty.description.lower() for goal in learning_goals):
            score += 0.3

        return score

    def find_mentor_matches(self, user_id: str, limit: int = 5) -> List[MentorMatch]:
        """Find suitable mentors for the user"""
        try:
            with get_db_session() as session:
                user = self.user_repo.get_by_id(session, user_id)
                if not user or not user.skill_assessment:
                    return []

                available_mentors = self.mentor_repo.get_available_mentors(session)
                matches = []

                for mentor in available_mentors:
                    score = self._calculate_mentor_compatibility(user.skill_assessment, mentor)
                    if score > 0.3:  # Minimum compatibility threshold
                        matches.append(MentorMatch(
                            mentor_id=mentor.id,
                            compatibility_score=score,
                            shared_skills=self._get_shared_skills(user.skill_assessment, mentor),
                            availability_overlap=self._calculate_availability_overlap(user, mentor),
                            experience_level=mentor.experience_level
                        ))

                matches.sort(key=lambda m: m.compatibility_score, reverse=True)
                return matches[:limit]

        except Exception as e:
            logger.error(f"Failed to find mentor matches: {str(e)}")
            return []

    def _calculate_mentor_compatibility(self, user_assessment: Dict[str, Any], mentor: Any) -> float:
        """Calculate compatibility score between user and mentor"""
        score = 0.0

        # Skill alignment
        user_languages = set(lang.lower() for lang in user_assessment.get("preferred_languages", []))
        mentor_skills = set(skill.lower() for skill in mentor.skills or [])
        skill_overlap = len(user_languages & mentor_skills)
        score += min(skill_overlap / max(len(user_languages), 1), 1.0) * 0.4

        # Experience level match
        user_exp = user_assessment.get("programming_experience", "beginner")
        if mentor.experience_level == "senior" and user_exp in ["beginner", "intermediate"]:
            score += 0.3
        elif mentor.experience_level == "mid" and user_exp == "beginner":
            score += 0.2

        # Learning goal alignment
        user_goals = user_assessment.get("learning_goals", [])
        mentor_specialties = mentor.specialties or []
        goal_alignment = any(goal.lower() in spec.lower() for goal in user_goals for spec in mentor_specialties)
        if goal_alignment:
            score += 0.3

        return min(score, 1.0)

    def _get_shared_skills(self, user_assessment: Dict[str, Any], mentor: Any) -> List[str]:
        """Get skills shared between user and mentor"""
        user_languages = set(lang.lower() for lang in user_assessment.get("preferred_languages", []))
        mentor_skills = set(skill.lower() for skill in mentor.skills or [])
        return list(user_languages & mentor_skills)

    def _calculate_availability_overlap(self, user: Any, mentor: Any) -> int:
        """Calculate hours of availability overlap per week"""
        user_hours = user.skill_assessment.get("available_hours", 5) if user.skill_assessment else 5
        mentor_hours = mentor.available_hours or 10

        return min(user_hours, mentor_hours)

    def track_completion_progress(self, user_id: str) -> Dict[str, Any]:
        """Track overall onboarding completion progress"""
        try:
            current_stage = self.get_user_stage(user_id)

            stage_weights = {
                OnboardingStage.REGISTRATION: 10,
                OnboardingStage.SKILL_ASSESSMENT: 20,
                OnboardingStage.BEGINNER_BOUNTIES: 30,
                OnboardingStage.MENTOR_MATCHING: 20,
                OnboardingStage.FIRST_SUBMISSION: 15,
                OnboardingStage.COMPLETED: 5
            }

            completed_weight = 0
            for stage, weight in stage_weights.items():
                if stage.value <= current_stage.value:
                    completed_weight += weight
                else:
                    break

            progress_percentage = min(completed_weight, 100)

            with get_db_session() as session:
                user = self.user_repo.get_by_id(session, user_id)

                return {
                    "current_stage": current_stage.value,
                    "progress_percentage": progress_percentage,
                    "completed_at": user.onboarding_completed_at if user else None,
                    "next_stage": self._get_next_stage(current_stage),
                    "estimated_completion": self._estimate_completion_date(user_id)
                }

        except Exception as e:
            logger.error(f"Failed to track completion progress: {str(e)}")
            return {}

    def _get_next_stage(self, current_stage: OnboardingStage) -> Optional[str]:
        """Get the next stage in onboarding flow"""
        if current_stage == OnboardingStage.COMPLETED:
            return None

        stage_order = [
            OnboardingStage.REGISTRATION,
            OnboardingStage.SKILL_ASSESSMENT,
            OnboardingStage.BEGINNER_BOUNTIES,
            OnboardingStage.MENTOR_MATCHING,
            OnboardingStage.FIRST_SUBMISSION,
            OnboardingStage.COMPLETED
        ]

        current_idx = stage_order.index(current_stage)
        if current_idx < len(stage_order) - 1:
            return stage_order[current_idx + 1].value

        return None

    def _estimate_completion_date(self, user_id: str) -> Optional[datetime]:
        """Estimate when user will complete onboarding"""
        try:
            current_stage = self.get_user_stage(user_id)

            # Rough estimates for each remaining stage
            stage_estimates = {
                OnboardingStage.SKILL_ASSESSMENT: 1,
                OnboardingStage.BEGINNER_BOUNTIES: 3,
                OnboardingStage.MENTOR_MATCHING: 2,
                OnboardingStage.FIRST_SUBMISSION: 7,
                OnboardingStage.COMPLETED: 0
            }

            remaining_days = 0
            stage_values = [s.value for s in OnboardingStage]
            current_idx = stage_values.index(current_stage.value)

            for i in range(current_idx + 1, len(stage_values)):
                stage = OnboardingStage(stage_values[i])
                remaining_days += stage_estimates.get(stage, 0)

            if remaining_days > 0:
                return datetime.utcnow() + timedelta(days=remaining_days)

            return None

        except Exception:
            return None

    def _validate_registration_complete(self, user_id: str) -> bool:
        """Check if user registration is complete"""
        try:
            with get_db_session() as session:
                user = self.user_repo.get_by_id(session, user_id)
                return user and user.email and user.github_username
        except Exception:
            return False

    def _validate_assessment_complete(self, user_id: str) -> bool:
        """Check if skill assessment is complete"""
        try:
            with get_db_session() as session:
                user = self.user_repo.get_by_id(session, user_id)
                return user and user.skill_assessment
        except Exception:
            return False

    def _validate_bounty_engagement(self, user_id: str) -> bool:
        """Check if user has engaged with beginner bounties"""
        try:
            with get_db_session() as session:
                viewed_bounties = self.bounty_repo.get_user_viewed_bounties(session, user_id)
                return len(viewed_bounties) >= 3
        except Exception:
            return False

    def _validate_mentor_assigned(self, user_id: str) -> bool:
        """Check if user has been assigned a mentor"""
        try:
            with get_db_session() as session:
                user = self.user_repo.get_by_id(session, user_id)
                return user and user.mentor_id
        except Exception:
            return False

    def _validate_submission_made(self, user_id: str) -> bool:
        """Check if user has made their first submission"""
        try:
            with get_db_session() as session:
                submissions = self.bounty_repo.get_user_submissions(session, user_id)
                return len(submissions) >= 1
        except Exception:
            return False
