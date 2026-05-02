#!/usr/bin/env python3
"""
Unit tests for Four-Layer Memory System.

Tests cover:
- MemoryEntry: serialization, deserialization
- SessionMemory: add, search, context, eviction, clear
- DailyMemory: add, read, search, cleanup
- LongTermMemory: add, search, persistence, remove, sort
- KnowledgeGraph: add_entity, add_relation, search, counts
- MemoryManager: remember, recall, promote, add_knowledge, status
"""

import json
import os
import tempfile
import pytest
from bounty_agent.memory_manager import (
    MemoryEntry,
    SessionMemory,
    DailyMemory,
    LongTermMemory,
    KnowledgeGraph,
    MemoryManager,
)


class TestMemoryEntry:
    def test_to_dict(self):
        entry = MemoryEntry(content="test", layer="session", importance=0.5)
        d = entry.to_dict()
        assert d["content"] == "test"
        assert d["layer"] == "session"
        assert d["importance"] == 0.5

    def test_from_dict(self):
        data = {"content": "test", "layer": "daily", "importance": 0.8,
                "topic": "bounty", "source": "agent", "tags": [], "metadata": {}}
        entry = MemoryEntry.from_dict(data)
        assert entry.content == "test"
        assert entry.layer == "daily"


class TestSessionMemory:
    def test_add_and_search(self):
        sm = SessionMemory()
        sm.add("Found bounty #861", topic="bounty", importance=0.9)
        sm.add("Agent restarted", topic="ops", importance=0.3)
        results = sm.search("bounty")
        assert len(results) == 1
        assert "861" in results[0].content

    def test_context_store(self):
        sm = SessionMemory()
        sm.set_context("active_bounty", "#861")
        assert sm.get_context("active_bounty") == "#861"
        assert sm.get_context("missing", "default") == "default"

    def test_max_entries_eviction(self):
        sm = SessionMemory(max_entries=3)
        sm.add("Low", importance=0.1)
        sm.add("Medium", importance=0.5)
        sm.add("High", importance=0.9)
        sm.add("Critical", importance=1.0)
        assert sm.size == 3

    def test_recent(self):
        sm = SessionMemory()
        sm.add("First")
        sm.add("Second")
        sm.add("Third")
        recent = sm.recent(2)
        assert len(recent) == 2

    def test_clear(self):
        sm = SessionMemory()
        sm.add("Test")
        sm.set_context("key", "value")
        sm.clear()
        assert sm.size == 0
        assert sm.get_context("key") is None

    def test_search_no_results(self):
        sm = SessionMemory()
        sm.add("Hello world")
        results = sm.search("xyz")
        assert len(results) == 0


class TestDailyMemory:
    @pytest.fixture
    def daily_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    def test_add_and_read(self, daily_dir):
        dm = DailyMemory(daily_dir)
        dm.add("Daily test entry", topic="test", importance=0.5)
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        entries = dm.read_day(today)
        assert len(entries) == 1

    def test_read_recent(self, daily_dir):
        dm = DailyMemory(daily_dir)
        dm.add("Today's entry")
        entries = dm.read_recent(days=1)
        assert len(entries) >= 1

    def test_search(self, daily_dir):
        dm = DailyMemory(daily_dir)
        dm.add("Bounty #861 completed", topic="bounty")
        dm.add("System check OK", topic="ops")
        results = dm.search("bounty")
        assert len(results) == 1

    def test_cleanup(self, daily_dir):
        dm = DailyMemory(daily_dir, retention_days=0)
        old_file = os.path.join(daily_dir, "2020-01-01.jsonl")
        with open(old_file, "w") as f:
            f.write('{"content":"old"}\n')
        deleted = dm.cleanup()
        assert deleted == 1

    def test_read_nonexistent_day(self, daily_dir):
        dm = DailyMemory(daily_dir)
        entries = dm.read_day("2099-12-31")
        assert len(entries) == 0


class TestLongTermMemory:
    @pytest.fixture
    def lt_path(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            yield os.path.join(tmpdir, "longterm.json")

    def test_add_and_search(self, lt_path):
        ltm = LongTermMemory(lt_path)
        ltm.add("Important decision: use Python", topic="architecture", importance=0.9)
        results = ltm.search("Python")
        assert len(results) == 1

    def test_persistence(self, lt_path):
        ltm = LongTermMemory(lt_path)
        ltm.add("Persist this")
        ltm2 = LongTermMemory(lt_path)
        assert ltm2.size == 1

    def test_remove(self, lt_path):
        ltm = LongTermMemory(lt_path)
        ltm.add("Entry 1")
        ltm.add("Entry 2")
        ltm.remove(0)
        assert ltm.size == 1

    def test_get_all(self, lt_path):
        ltm = LongTermMemory(lt_path)
        ltm.add("A", importance=0.3)
        ltm.add("B", importance=0.9)
        all_entries = ltm.get_all()
        assert len(all_entries) == 2
        assert all_entries[0].importance >= all_entries[1].importance


class TestKnowledgeGraph:
    @pytest.fixture
    def kg_path(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            yield os.path.join(tmpdir, "knowledge.db")

    def test_add_entity(self, kg_path):
        kg = KnowledgeGraph(kg_path)
        eid = kg.add_entity("Agent-1", "agent", {"tier": "S"})
        assert eid > 0

    def test_add_relation(self, kg_path):
        kg = KnowledgeGraph(kg_path)
        kg.add_entity("Agent-1", "agent")
        kg.add_entity("Bounty-861", "bounty")
        kg.add_relation("Agent-1", "Bounty-861", "claimed", weight=1.0)
        relations = kg.get_relations("Agent-1")
        assert len(relations) == 1

    def test_search_entities(self, kg_path):
        kg = KnowledgeGraph(kg_path)
        kg.add_entity("Qwen-72B", "model")
        kg.add_entity("DeepSeek-V3", "model")
        results = kg.search_entities("Qwen", entity_type="model")
        assert len(results) == 1

    def test_counts(self, kg_path):
        kg = KnowledgeGraph(kg_path)
        kg.add_entity("E1", "test")
        kg.add_entity("E2", "test")
        kg.add_relation("E1", "E2", "connects")
        assert kg.entity_count >= 2
        assert kg.relation_count >= 1

    def test_get_entity(self, kg_path):
        kg = KnowledgeGraph(kg_path)
        kg.add_entity("TestEntity", "test", {"key": "value"})
        entity = kg.get_entity("TestEntity")
        assert entity is not None
        assert entity["type"] == "test"

    def test_get_nonexistent_entity(self, kg_path):
        kg = KnowledgeGraph(kg_path)
        entity = kg.get_entity("NoSuchEntity")
        assert entity is None

    def test_get_relations_nonexistent(self, kg_path):
        kg = KnowledgeGraph(kg_path)
        relations = kg.get_relations("NoSuchEntity")
        assert len(relations) == 0


class TestMemoryManager:
    @pytest.fixture
    def mm(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            yield MemoryManager(base_dir=tmpdir)

    def test_remember_auto_high_importance(self, mm):
        mm.remember("Critical bounty found!", importance=0.95, topic="bounty")
        assert mm.session.size == 1
        assert mm.longterm.size == 1

    def test_remember_auto_normal_importance(self, mm):
        mm.remember("Routine scan complete", importance=0.3)
        assert mm.session.size == 1
        assert mm.longterm.size == 0

    def test_recall_across_layers(self, mm):
        mm.remember("Bounty #861 in SolFoundry", importance=0.9, topic="bounty")
        results = mm.recall("Bounty #861")
        assert len(results) >= 1

    def test_promote_to_longterm(self, mm):
        mm.daily.add("Great discovery about agent relay", topic="architecture", importance=0.6)
        result = mm.promote_to_longterm("agent relay", topic="architecture")
        assert result is True
        assert mm.longterm.size == 1

    def test_add_knowledge(self, mm):
        mm.add_knowledge("Mac-Mini-Cluster", "infrastructure", [
            {"target": "Gateway-1", "type": "hosts", "weight": 1.0},
            {"target": "Gateway-2", "type": "hosts", "weight": 1.0},
        ])
        assert mm.knowledge.entity_count >= 1
        assert mm.knowledge.relation_count >= 2

    def test_get_status(self, mm):
        mm.remember("Status test", importance=0.5)
        status = mm.get_status()
        assert "session_entries" in status
        assert "knowledge_entities" in status

    def test_cleanup(self, mm):
        stats = mm.cleanup()
        assert "daily_files_deleted" in stats

    def test_remember_specific_layer(self, mm):
        mm.remember("Session only", importance=0.5, layer="session")
        assert mm.session.size == 1
        mm.remember("Daily only", importance=0.5, layer="daily")
        mm.remember("Longterm only", importance=0.8, layer="longterm")
        assert mm.longterm.size == 1
