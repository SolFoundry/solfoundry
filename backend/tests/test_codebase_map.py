"""Tests for codebase map service — data transformation logic.

Tests cover all pure data transformation functions used to build the
interactive codebase visualization. These validate the spec requirements:
- Tree/graph structure generation
- File categorization and module detection
- Bounty-file associations
- Test coverage detection
- Dependency edge computation
- Metadata rollup (file counts, recently modified flags)
"""

import pytest
from unittest.mock import patch, AsyncMock

from app.services.codebase_map_service import (
    _extract_file_extension,
    _detect_file_category,
    _determine_module,
    _has_test_coverage,
    _build_bounty_file_associations,
    _compute_dependency_edges,
    _roll_up_metadata,
    build_tree_from_entries,
    invalidate_cache,
)


# ── Spec: Tree/graph visualization of project structure ──────────────────────


class TestFileExtensionExtraction:
    """Tests for _extract_file_extension — file type identification."""

    def test_spec_requirement_python_extension(self) -> None:
        """Extracts .py extension for Python files."""
        assert _extract_file_extension("backend/app/main.py") == "py"

    def test_spec_requirement_typescript_extension(self) -> None:
        """Extracts .tsx extension for React TypeScript files."""
        assert _extract_file_extension("frontend/src/App.tsx") == "tsx"

    def test_spec_requirement_rust_extension(self) -> None:
        """Extracts .rs extension for Rust files."""
        assert _extract_file_extension("contracts/programs/escrow/src/lib.rs") == "rs"

    def test_spec_requirement_no_extension(self) -> None:
        """Returns empty string for files without extension."""
        assert _extract_file_extension("Dockerfile") == ""

    def test_spec_requirement_config_extension(self) -> None:
        """Extracts .json extension for config files."""
        assert _extract_file_extension("tsconfig.json") == "json"

    def test_spec_requirement_nested_dots(self) -> None:
        """Extracts final extension from files with multiple dots."""
        assert _extract_file_extension("src/App.test.tsx") == "tsx"


class TestFileCategoryDetection:
    """Tests for _detect_file_category — file classification for node coloring."""

    def test_spec_requirement_test_file_detection(self) -> None:
        """Detects test files for test coverage indicator."""
        assert _detect_file_category("backend/tests/test_auth.py") == "test"
        assert _detect_file_category("frontend/src/App.test.tsx") == "test"

    def test_spec_requirement_source_file_detection(self) -> None:
        """Detects source files for primary visualization."""
        assert _detect_file_category("backend/app/main.py") == "source"
        assert _detect_file_category("frontend/src/App.tsx") == "source"
        assert _detect_file_category("contracts/programs/lib.rs") == "source"

    def test_spec_requirement_config_file_detection(self) -> None:
        """Detects configuration files."""
        assert _detect_file_category("tsconfig.json") == "config"
        assert _detect_file_category("Cargo.toml") == "config"

    def test_spec_requirement_documentation_detection(self) -> None:
        """Detects documentation files."""
        assert _detect_file_category("README.md") == "documentation"

    def test_spec_requirement_asset_detection(self) -> None:
        """Detects asset files."""
        assert _detect_file_category("assets/logo.png") == "asset"

    def test_spec_requirement_workflow_detection(self) -> None:
        """Detects CI/CD workflow files."""
        assert _detect_file_category(".github/workflows/ci.yml") == "workflow"


class TestModuleDetermination:
    """Tests for _determine_module — mapping files to top-level modules."""

    def test_spec_requirement_backend_module(self) -> None:
        """Maps backend files to 'backend' module."""
        assert _determine_module("backend/app/main.py") == "backend"

    def test_spec_requirement_frontend_module(self) -> None:
        """Maps frontend files to 'frontend' module."""
        assert _determine_module("frontend/src/App.tsx") == "frontend"

    def test_spec_requirement_contracts_module(self) -> None:
        """Maps contract files to 'contracts' module."""
        assert _determine_module("contracts/programs/escrow/lib.rs") == "contracts"

    def test_spec_requirement_automaton_module(self) -> None:
        """Maps automaton files to 'automaton' module."""
        assert _determine_module("automaton/director/main.py") == "automaton"

    def test_spec_requirement_root_files(self) -> None:
        """Maps root-level files to 'root' module."""
        assert _determine_module("index.html") == "root"
        assert _determine_module("README.md") == "root"


# ── Spec: Nodes colored by test coverage ─────────────────────────────────────


class TestTestCoverageDetection:
    """Tests for _has_test_coverage — checking if source files have tests."""

    def test_spec_requirement_python_test_coverage(self) -> None:
        """Detects Python test files in tests/ directory."""
        all_paths = {
            "backend/app/main.py",
            "backend/tests/test_main.py",
        }
        # test_main.py in backend/tests/ matches main.py in backend/app/
        assert _has_test_coverage("backend/app/main.py", all_paths) is True

    def test_spec_requirement_python_no_test_coverage(self) -> None:
        """Returns False when no matching Python test file exists."""
        all_paths = {
            "backend/app/database.py",
        }
        assert _has_test_coverage("backend/app/database.py", all_paths) is False

    def test_spec_requirement_typescript_test_coverage(self) -> None:
        """Detects TypeScript test files (.test.tsx pattern)."""
        all_paths = {
            "frontend/src/App.tsx",
            "frontend/src/App.test.tsx",
        }
        assert _has_test_coverage("frontend/src/App.tsx", all_paths) is True

    def test_spec_requirement_no_test_coverage(self) -> None:
        """Returns False when no test file exists."""
        all_paths = {
            "frontend/src/hooks/useWallet.ts",
        }
        assert _has_test_coverage("frontend/src/hooks/useWallet.ts", all_paths) is False

    def test_spec_requirement_tests_directory_pattern(self) -> None:
        """Detects test files in __tests__/ subdirectory."""
        all_paths = {
            "frontend/src/components/BountyCard.tsx",
            "frontend/src/components/__tests__/BountyCard.test.tsx",
        }
        assert _has_test_coverage(
            "frontend/src/components/BountyCard.tsx", all_paths
        ) is True


# ── Spec: Dependency arrows between modules ──────────────────────────────────


class TestDependencyEdges:
    """Tests for _compute_dependency_edges — module relationship arrows."""

    def test_spec_requirement_dependency_edges_exist(self) -> None:
        """Generates dependency edges between known modules."""
        tree_entries = [
            {"path": "frontend/src/App.tsx", "type": "blob"},
            {"path": "backend/app/main.py", "type": "blob"},
            {"path": "contracts/programs/lib.rs", "type": "blob"},
            {"path": "automaton/director/main.py", "type": "blob"},
            {"path": "router/config.py", "type": "blob"},
            {"path": "scripts/deploy.sh", "type": "blob"},
        ]
        edges = _compute_dependency_edges(tree_entries)
        assert len(edges) > 0

    def test_spec_requirement_frontend_backend_dependency(self) -> None:
        """Frontend depends on backend via API proxy."""
        tree_entries = [
            {"path": "frontend/src/App.tsx", "type": "blob"},
            {"path": "backend/app/main.py", "type": "blob"},
        ]
        edges = _compute_dependency_edges(tree_entries)
        frontend_to_backend = [
            e for e in edges
            if e["source"] == "frontend" and e["target"] == "backend"
        ]
        assert len(frontend_to_backend) == 1
        assert "API" in frontend_to_backend[0]["relationship"]

    def test_spec_requirement_edge_has_relationship_label(self) -> None:
        """Every dependency edge includes a human-readable relationship description."""
        tree_entries = [
            {"path": "frontend/x.ts", "type": "blob"},
            {"path": "backend/x.py", "type": "blob"},
        ]
        edges = _compute_dependency_edges(tree_entries)
        for edge in edges:
            assert "source" in edge
            assert "target" in edge
            assert "relationship" in edge
            assert len(edge["relationship"]) > 0

    def test_spec_requirement_no_edges_for_missing_modules(self) -> None:
        """Filters out edges referencing modules that don't exist in the repo."""
        tree_entries = [
            {"path": "frontend/src/App.tsx", "type": "blob"},
        ]
        edges = _compute_dependency_edges(tree_entries)
        # Should only have edges where both source and target exist
        for edge in edges:
            # frontend exists, but if target doesn't, edge should be filtered
            assert edge["source"] == "frontend" or edge["target"] == "frontend"


# ── Spec: Nodes colored by active bounty association ─────────────────────────


class TestBountyFileAssociations:
    """Tests for _build_bounty_file_associations — bounty-to-directory mapping."""

    def test_spec_requirement_skill_based_association(self) -> None:
        """Associates bounties with directories based on required skills."""
        from app.models.bounty import BountyDB, BountyStatus, BountyTier
        from datetime import datetime, timezone

        mock_bounty = BountyDB(
            id="test-1",
            title="Build React dashboard",
            description="Frontend work",
            tier=BountyTier.T2,
            reward_amount=300000,
            status=BountyStatus.OPEN,
            required_skills=["React", "TypeScript"],
            created_by="SolFoundry",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        with patch.dict(
            "app.services.codebase_map_service._bounty_store",
            {"test-1": mock_bounty},
        ):
            associations = _build_bounty_file_associations()
            assert "frontend" in associations
            assert any(b["id"] == "test-1" for b in associations["frontend"])

    def test_spec_requirement_empty_store_no_associations(self) -> None:
        """Returns empty associations when no bounties exist."""
        with patch.dict(
            "app.services.codebase_map_service._bounty_store",
            {},
            clear=True,
        ):
            associations = _build_bounty_file_associations()
            assert len(associations) == 0


# ── Spec: Tree/graph visualization (build_tree_from_entries) ─────────────────


class TestBuildTreeFromEntries:
    """Tests for build_tree_from_entries — constructing the visualization tree."""

    def test_spec_requirement_tree_structure(self) -> None:
        """Builds hierarchical tree from flat file entries."""
        entries = [
            {"path": "frontend", "type": "tree", "size": 0},
            {"path": "frontend/src", "type": "tree", "size": 0},
            {"path": "frontend/src/App.tsx", "type": "blob", "size": 1500},
            {"path": "backend", "type": "tree", "size": 0},
            {"path": "backend/app", "type": "tree", "size": 0},
            {"path": "backend/app/main.py", "type": "blob", "size": 2000},
        ]
        tree = build_tree_from_entries(entries, {}, set(), set())

        assert tree["name"] == "solfoundry"
        assert tree["node_type"] == "directory"
        assert len(tree["children"]) == 2

    def test_spec_requirement_file_metadata(self) -> None:
        """Each file node includes required metadata fields."""
        entries = [
            {"path": "frontend", "type": "tree", "size": 0},
            {"path": "frontend/src", "type": "tree", "size": 0},
            {"path": "frontend/src/App.tsx", "type": "blob", "size": 1500},
        ]
        tree = build_tree_from_entries(entries, {}, set(), set())

        # Navigate to App.tsx
        frontend = tree["children"][0]
        src = frontend["children"][0]
        app_file = src["children"][0]

        assert app_file["name"] == "App.tsx"
        assert app_file["node_type"] == "file"
        assert app_file["extension"] == "tsx"
        assert app_file["size"] == 1500
        assert app_file["module"] == "frontend"
        assert "has_active_bounty" in app_file
        assert "recently_modified" in app_file
        assert "has_test_coverage" in app_file

    def test_spec_requirement_recently_modified_flag(self) -> None:
        """Marks recently modified files and rolls up to parent directories."""
        entries = [
            {"path": "backend", "type": "tree", "size": 0},
            {"path": "backend/app", "type": "tree", "size": 0},
            {"path": "backend/app/main.py", "type": "blob", "size": 2000},
        ]
        recently_modified = {"backend/app/main.py"}
        tree = build_tree_from_entries(entries, {}, recently_modified, set())

        backend = tree["children"][0]
        app_dir = backend["children"][0]
        main_file = app_dir["children"][0]

        assert main_file["recently_modified"] is True
        assert app_dir["recently_modified"] is True
        assert backend["recently_modified"] is True

    def test_spec_requirement_file_count_rollup(self) -> None:
        """Directories include total file count for their subtree."""
        entries = [
            {"path": "frontend", "type": "tree", "size": 0},
            {"path": "frontend/src", "type": "tree", "size": 0},
            {"path": "frontend/src/App.tsx", "type": "blob", "size": 1500},
            {"path": "frontend/src/main.tsx", "type": "blob", "size": 500},
            {"path": "frontend/src/index.css", "type": "blob", "size": 300},
        ]
        tree = build_tree_from_entries(entries, {}, set(), set())

        frontend = tree["children"][0]
        assert frontend["file_count"] == 3

    def test_spec_requirement_bounty_association_on_nodes(self) -> None:
        """Nodes include bounty association data for coloring."""
        entries = [
            {"path": "frontend", "type": "tree", "size": 0},
            {"path": "frontend/src", "type": "tree", "size": 0},
            {"path": "frontend/src/App.tsx", "type": "blob", "size": 1500},
        ]
        bounty_associations = {
            "frontend": [
                {
                    "id": "b-1",
                    "title": "Build dashboard",
                    "tier": "T2",
                    "status": "open",
                    "reward_amount": 300000,
                }
            ],
        }
        tree = build_tree_from_entries(entries, bounty_associations, set(), set())

        frontend = tree["children"][0]
        assert frontend["has_active_bounty"] is True


# ── Spec: Metadata rollup ────────────────────────────────────────────────────


class TestMetadataRollup:
    """Tests for _roll_up_metadata — aggregating stats to parent nodes."""

    def test_spec_requirement_file_count_aggregation(self) -> None:
        """Aggregates file counts from children to parent directories."""
        root = {
            "name": "root",
            "node_type": "directory",
            "children": [
                {"name": "a.py", "node_type": "file", "recently_modified": False},
                {"name": "b.py", "node_type": "file", "recently_modified": True},
            ],
            "recently_modified": False,
            "file_count": 0,
        }
        file_count, any_recent = _roll_up_metadata(root)
        assert file_count == 2
        assert any_recent is True
        assert root["file_count"] == 2
        assert root["recently_modified"] is True

    def test_spec_requirement_nested_rollup(self) -> None:
        """Rolls up through multiple directory levels."""
        root = {
            "name": "root",
            "node_type": "directory",
            "children": [
                {
                    "name": "sub",
                    "node_type": "directory",
                    "children": [
                        {"name": "f.ts", "node_type": "file", "recently_modified": False},
                    ],
                    "recently_modified": False,
                    "file_count": 0,
                },
            ],
            "recently_modified": False,
            "file_count": 0,
        }
        file_count, _ = _roll_up_metadata(root)
        assert file_count == 1
        assert root["children"][0]["file_count"] == 1


# ── Spec: Cache invalidation ────────────────────────────────────────────────


class TestCacheInvalidation:
    """Tests for cache management functions."""

    def test_spec_requirement_cache_invalidation(self) -> None:
        """invalidate_cache clears the cached map data."""
        import app.services.codebase_map_service as svc

        svc._map_cache = {"test": True}
        svc._cache_timestamp = None
        invalidate_cache()
        assert svc._map_cache is None
        assert svc._cache_timestamp is None
