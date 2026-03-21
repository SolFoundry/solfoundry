from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum

Base = declarative_base()


class OnboardingStage(enum.Enum):
    PROFILE_SETUP = "profile_setup"
    SKILL_ASSESSMENT = "skill_assessment"
    FIRST_BOUNTY = "first_bounty"
    MENTOR_ASSIGNMENT = "mentor_assignment"
    COMPLETION = "completion"


class ContributorOnboarding(Base):
    __tablename__ = 'contributor_onboarding'

    id = Column(Integer, primary_key=True)
    github_username = Column(String(255), unique=True, nullable=False)
    wallet_address = Column(String(44), nullable=True)
    current_stage = Column(String(50), default=OnboardingStage.PROFILE_SETUP.value, nullable=False)

    # Progress tracking
    profile_setup_completed = Column(Boolean, default=False)
    skill_assessment_completed = Column(Boolean, default=False)
    first_bounty_completed = Column(Boolean, default=False)
    mentor_assigned = Column(Boolean, default=False)
    onboarding_completed = Column(Boolean, default=False)

    # Completion timestamps
    profile_setup_completed_at = Column(DateTime, nullable=True)
    skill_assessment_completed_at = Column(DateTime, nullable=True)
    first_bounty_completed_at = Column(DateTime, nullable=True)
    mentor_assignment_completed_at = Column(DateTime, nullable=True)
    onboarding_completed_at = Column(DateTime, nullable=True)

    # Metadata and tracking
    skills_data = Column(JSON, nullable=True)
    preferred_tech_stack = Column(Text, nullable=True)
    experience_level = Column(String(50), nullable=True)
    first_bounty_id = Column(Integer, nullable=True)
    assigned_mentor = Column(String(255), nullable=True)
    progress_notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def advance_stage(self):
        """Move to the next onboarding stage"""
        stages = list(OnboardingStage)
        current_idx = stages.index(OnboardingStage(self.current_stage))

        if current_idx < len(stages) - 1:
            self.current_stage = stages[current_idx + 1].value
            self.updated_at = datetime.utcnow()
            return True
        return False

    def complete_profile_setup(self, wallet_addr=None, skills=None, tech_stack=None, exp_level=None):
        """Complete profile setup stage"""
        self.profile_setup_completed = True
        self.profile_setup_completed_at = datetime.utcnow()
        if wallet_addr:
            self.wallet_address = wallet_addr
        if skills:
            self.skills_data = skills
        if tech_stack:
            self.preferred_tech_stack = tech_stack
        if exp_level:
            self.experience_level = exp_level
        self.advance_stage()

    def complete_skill_assessment(self, assessment_data):
        """Complete skill assessment stage"""
        self.skill_assessment_completed = True
        self.skill_assessment_completed_at = datetime.utcnow()
        if assessment_data:
            existing_skills = self.skills_data or {}
            existing_skills.update(assessment_data)
            self.skills_data = existing_skills
        self.advance_stage()

    def complete_first_bounty(self, bounty_id):
        """Complete first bounty stage"""
        self.first_bounty_completed = True
        self.first_bounty_completed_at = datetime.utcnow()
        self.first_bounty_id = bounty_id
        self.advance_stage()

    def assign_mentor(self, mentor_username):
        """Assign mentor and complete mentor assignment stage"""
        self.mentor_assigned = True
        self.mentor_assignment_completed_at = datetime.utcnow()
        self.assigned_mentor = mentor_username
        self.advance_stage()

    def complete_onboarding(self):
        """Mark onboarding as fully completed"""
        self.onboarding_completed = True
        self.onboarding_completed_at = datetime.utcnow()
        self.current_stage = OnboardingStage.COMPLETION.value

    def get_completion_percentage(self):
        """Calculate onboarding completion percentage"""
        completed_stages = sum([
            self.profile_setup_completed,
            self.skill_assessment_completed,
            self.first_bounty_completed,
            self.mentor_assigned,
            self.onboarding_completed
        ])
        return int((completed_stages / 5) * 100)

    def to_dict(self):
        """Convert model to dictionary"""
        return {
            'id': self.id,
            'github_username': self.github_username,
            'wallet_address': self.wallet_address,
            'current_stage': self.current_stage,
            'completion_percentage': self.get_completion_percentage(),
            'profile_setup_completed': self.profile_setup_completed,
            'skill_assessment_completed': self.skill_assessment_completed,
            'first_bounty_completed': self.first_bounty_completed,
            'mentor_assigned': self.mentor_assigned,
            'onboarding_completed': self.onboarding_completed,
            'skills_data': self.skills_data,
            'preferred_tech_stack': self.preferred_tech_stack,
            'experience_level': self.experience_level,
            'first_bounty_id': self.first_bounty_id,
            'assigned_mentor': self.assigned_mentor,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
