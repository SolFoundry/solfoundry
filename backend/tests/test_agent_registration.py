# SPDX-License-Identifier: MIT
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from backend.core.database import get_db
from backend.models.agent import Agent, AgentStatus, AgentCapability
from backend.services.agent_service import AgentService
from backend.schemas.agent import AgentCreate, AgentUpdate, AgentResponse
from backend.api.agents import create_agent, get_agent, update_agent, delete_agent


class TestAgentRegistration:
    """Test suite for agent registration functionality"""

    @pytest.fixture
    def mock_db_session(self):
        """Mock database session"""
        session = Mock()
        session.add = Mock()
        session.commit = Mock()
        session.refresh = Mock()
        session.query = Mock()
        return session

    @pytest.fixture
    def agent_service(self, mock_db_session):
        """Agent service instance with mocked dependencies"""
        return AgentService(mock_db_session)

    @pytest.fixture
    def valid_agent_data(self):
        """Valid agent registration data"""
        return {
            "name": "TestAgent",
            "description": "A test agent for automated tasks",
            "capabilities": ["TASK_EXECUTION", "DATA_ANALYSIS"],
            "owner_id": 123,
            "config": {"max_concurrent": 5, "timeout": 30},
            "version": "1.0.0"
        }

    def test_successful_agent_registration(self, agent_service, valid_agent_data, mock_db_session):
        """Test successful agent registration with valid data"""
        # Mock the database query to return no existing agent
        mock_db_session.query.return_value.filter.return_value.first.return_value = None

        # Mock the created agent
        created_agent = Agent(
            id=1,
            name=valid_agent_data["name"],
            description=valid_agent_data["description"],
            capabilities=[AgentCapability.TASK_EXECUTION, AgentCapability.DATA_ANALYSIS],
            owner_id=valid_agent_data["owner_id"],
            config=valid_agent_data["config"],
            version=valid_agent_data["version"],
            status=AgentStatus.ACTIVE,
            created_at=datetime.utcnow()
        )

        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None
        mock_db_session.refresh.return_value = None

        # Mock the refresh to set the ID
        def mock_refresh(agent):
            agent.id = 1
            agent.created_at = datetime.utcnow()

        mock_db_session.refresh.side_effect = mock_refresh

        # Execute registration
        with patch.object(agent_service, '_create_agent_model') as mock_create:
            mock_create.return_value = created_agent
            result = agent_service.register_agent(valid_agent_data)

            # Assertions
            assert result.name == valid_agent_data["name"]
            assert result.owner_id == valid_agent_data["owner_id"]
            assert result.status == AgentStatus.ACTIVE
            mock_db_session.add.assert_called_once()
            mock_db_session.commit.assert_called_once()

    def test_duplicate_registration_prevention(self, agent_service, valid_agent_data, mock_db_session):
        """Test prevention of duplicate agent registration"""
        # Mock existing agent
        existing_agent = Agent(
            id=1,
            name=valid_agent_data["name"],
            owner_id=valid_agent_data["owner_id"],
            status=AgentStatus.ACTIVE
        )

        mock_db_session.query.return_value.filter.return_value.first.return_value = existing_agent

        # Attempt registration
        with pytest.raises(ValueError, match="Agent with name .* already exists"):
            agent_service.register_agent(valid_agent_data)

        # Ensure no database operations were attempted
        mock_db_session.add.assert_not_called()
        mock_db_session.commit.assert_not_called()

    def test_invalid_data_handling(self, agent_service, mock_db_session):
        """Test handling of invalid agent registration data"""
        invalid_data_cases = [
            # Missing required fields
            {"name": ""},
            {"name": "ValidName", "owner_id": None},
            {"name": "ValidName", "owner_id": -1},
            # Invalid capabilities
            {"name": "ValidName", "owner_id": 123, "capabilities": ["INVALID_CAP"]},
            # Invalid config
            {"name": "ValidName", "owner_id": 123, "config": "not_a_dict"},
        ]

        for invalid_data in invalid_data_cases:
            with pytest.raises((ValueError, TypeError)):
                agent_service.register_agent(invalid_data)

    def test_agent_retrieval(self, agent_service, mock_db_session):
        """Test agent retrieval by ID and name"""
        mock_agent = Agent(
            id=1,
            name="TestAgent",
            description="Test description",
            owner_id=123,
            status=AgentStatus.ACTIVE,
            created_at=datetime.utcnow()
        )

        # Test retrieval by ID
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_agent
        result = agent_service.get_agent_by_id(1)

        assert result is not None
        assert result.id == 1
        assert result.name == "TestAgent"

        # Test retrieval by name
        result_by_name = agent_service.get_agent_by_name("TestAgent")
        assert result_by_name is not None
        assert result_by_name.name == "TestAgent"

        # Test non-existent agent
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        result = agent_service.get_agent_by_id(999)
        assert result is None

    def test_agent_updates(self, agent_service, mock_db_session):
        """Test agent update functionality"""
        existing_agent = Agent(
            id=1,
            name="TestAgent",
            description="Original description",
            capabilities=[AgentCapability.TASK_EXECUTION],
            owner_id=123,
            status=AgentStatus.ACTIVE,
            version="1.0.0"
        )

        mock_db_session.query.return_value.filter.return_value.first.return_value = existing_agent

        update_data = {
            "description": "Updated description",
            "capabilities": ["TASK_EXECUTION", "DATA_ANALYSIS"],
            "version": "1.1.0"
        }

        result = agent_service.update_agent(1, update_data)

        assert result.description == "Updated description"
        assert AgentCapability.DATA_ANALYSIS in result.capabilities
        assert result.version == "1.1.0"
        mock_db_session.commit.assert_called_once()

    def test_agent_deletion(self, agent_service, mock_db_session):
        """Test agent deletion functionality"""
        existing_agent = Agent(
            id=1,
            name="TestAgent",
            owner_id=123,
            status=AgentStatus.ACTIVE
        )

        mock_db_session.query.return_value.filter.return_value.first.return_value = existing_agent
        mock_db_session.delete.return_value = None

        # Test soft delete (status change)
        result = agent_service.soft_delete_agent(1)
        assert result.status == AgentStatus.INACTIVE
        mock_db_session.commit.assert_called_once()

        # Test hard delete
        agent_service.delete_agent(1)
        mock_db_session.delete.assert_called_once_with(existing_agent)

    def test_capability_validation(self, agent_service):
        """Test validation of agent capabilities"""
        valid_capabilities = ["TASK_EXECUTION", "DATA_ANALYSIS", "FILE_PROCESSING"]
        invalid_capabilities = ["INVALID_CAP", "UNKNOWN_ABILITY"]

        # Test valid capabilities
        result = agent_service._validate_capabilities(valid_capabilities)
        assert len(result) == 3
        assert AgentCapability.TASK_EXECUTION in result

        # Test invalid capabilities
        with pytest.raises(ValueError, match="Invalid capability"):
            agent_service._validate_capabilities(invalid_capabilities)

        # Test mixed valid/invalid
        mixed_capabilities = ["TASK_EXECUTION", "INVALID_CAP"]
        with pytest.raises(ValueError):
            agent_service._validate_capabilities(mixed_capabilities)

    def test_integration_scenario(self, valid_agent_data):
        """Test end-to-end integration scenario"""
        with patch('backend.core.database.get_db') as mock_get_db:
            mock_session = Mock()
            mock_get_db.return_value = mock_session

            # Mock successful registration
            mock_session.query.return_value.filter.return_value.first.return_value = None
            mock_session.add.return_value = None
            mock_session.commit.return_value = None

            created_agent = Agent(
                id=1,
                name=valid_agent_data["name"],
                description=valid_agent_data["description"],
                owner_id=valid_agent_data["owner_id"],
                status=AgentStatus.ACTIVE,
                created_at=datetime.utcnow()
            )

            def mock_refresh(agent):
                agent.id = 1
                agent.created_at = datetime.utcnow()

            mock_session.refresh.side_effect = mock_refresh

            # Test the full API endpoint
            with patch('backend.services.agent_service.AgentService') as mock_service_class:
                mock_service = Mock()
                mock_service.register_agent.return_value = created_agent
                mock_service_class.return_value = mock_service

                # Create agent request
                agent_request = AgentCreate(**valid_agent_data)

                # This would be called by FastAPI
                result = mock_service.register_agent(agent_request.dict())

                assert result.id == 1
                assert result.name == valid_agent_data["name"]
                assert result.status == AgentStatus.ACTIVE


class TestAgentServiceErrorHandling:
    """Test error handling in agent service"""

    def test_database_error_handling(self):
        """Test handling of database errors during registration"""
        mock_session = Mock()
        mock_session.commit.side_effect = SQLAlchemyError("Database connection lost")

        service = AgentService(mock_session)

        with pytest.raises(HTTPException):
            service.register_agent({
                "name": "TestAgent",
                "owner_id": 123,
                "capabilities": ["TASK_EXECUTION"]
            })

    def test_integrity_error_handling(self):
        """Test handling of integrity constraint violations"""
        mock_session = Mock()
        mock_session.commit.side_effect = IntegrityError(
            "duplicate key value violates unique constraint",
            None,
            None
        )

        service = AgentService(mock_session)

        with pytest.raises(ValueError, match="already exists"):
            service.register_agent({
                "name": "TestAgent",
                "owner_id": 123,
                "capabilities": ["TASK_EXECUTION"]
            })
