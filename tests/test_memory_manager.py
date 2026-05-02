"""Unit tests for memory_manager module."""

import time
import tempfile
import os
from bounty_agent.memory_manager import (
    MemoryEntry,
    SessionMemory,
    DailyMemory,
    LongTermMemory,
)


class TestMemoryEntry:
    def test_create(self):
        entry = MemoryEntry(content="test content", layer="session", topic="bounty")
        assert entry.content == "test content"
        assert entry.layer == "session"
        assert entry.topic == "bounty"

    def test_to_dict(self):
        entry = MemoryEntry(content="hello", layer="session", topic="test", importance=0.9)
        d = entry.to_dict()
        assert d["content"] == "hello"
        assert d["layer"] == "session"
        assert d["importance"] == 0.9

    def test_from_dict(self):
        data = {"content": "world", "layer": "daily", "topic": "research",
                "importance": 0.5, "timestamp": time.time(), "source": "agent"}
        entry = MemoryEntry.from_dict(data)
        assert entry.content == "world"

    def test_default_importance(self):
        entry = MemoryEntry(content="x", layer="session")
        assert entry.importance == 0.5


class TestSessionMemory:
    def setup_method(self):
        self.sm = SessionMemory(max_entries=10)

    def test_add_entry(self):
        self.sm.add("Discovered bounty #861", topic="bounty", importance=0.9)
        assert self.sm.size == 1

    def test_add_multiple(self):
        for i in range(5):
            self.sm.add(f"Entry {i}", topic="test")
        assert self.sm.size == 5

    def test_context_set_get(self):
        self.sm.set_context("current_bounty", "861")
        assert self.sm.get_context("current_bounty") == "861"

    def test_context_default(self):
        assert self.sm.get_context("missing", "default") == "default"

    def test_search(self):
        self.sm.add("Found SolFoundry bounty #855", topic="bounty")
        self.sm.add("Security audit completed", topic="security")
        results = self.sm.search("bounty")
        assert len(results) >= 1

    def test_recent(self):
        for i in range(8):
            self.sm.add(f"Entry {i}")
        recent = self.sm.recent(3)
        assert len(recent) == 3

    def test_clear(self):
        self.sm.add("some content")
        self.sm.clear()
        assert self.sm.size == 0

    def test_max_entries_eviction(self):
        sm = SessionMemory(max_entries=3)
        for i in range(5):
            sm.add(f"Entry {i}")
        assert sm.size <= 3


class TestDailyMemory:
    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.dm = DailyMemory(base_dir=self.tmpdir, retention_days=7)

    def test_add_and_read(self):
        self.dm.add("Today's discovery", topic="bounty")
        today = time.strftime("%Y-%m-%d")
        entries = self.dm.read_day(today)
        assert len(entries) >= 1

    def test_read_nonexistent_day(self):
        entries = self.dm.read_day("2099-01-01")
        assert entries == []

    def test_read_recent(self):
        self.dm.add("Recent entry 1")
        self.dm.add("Recent entry 2")
        recent = self.dm.read_recent(days=1)
        assert len(recent) >= 2

    def test_search(self):
        self.dm.add("SolFoundry bounty #861", topic="bounty")
        self.dm.add("Random note", topic="misc")
        results = self.dm.search("SolFoundry", days=1)
        assert len(results) >= 1


class TestLongTermMemory:
    def setup_method(self):
        self.tmpfile = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
        self.tmpfile.close()
        self.ltm = LongTermMemory(filepath=self.tmpfile.name)

    def teardown_method(self):
        try:
            os.unlink(self.tmpfile.name)
        except FileNotFoundError:
            pass

    def test_add_entry(self):
        self.ltm.add("Important finding", topic="research", importance=0.9)
        results = self.ltm.search("finding")
        assert len(results) >= 1

    def test_persistence(self):
        self.ltm.add("Persisted data", topic="test")
        ltm2 = LongTermMemory(filepath=self.tmpfile.name)
        results = ltm2.search("Persisted")
        assert len(results) >= 1

    def test_remove_entry(self):
        self.ltm.add("To be removed", topic="temp")
        self.ltm.remove(0)

    def test_search_empty(self):
        results = self.ltm.search("nothing_here")
        assert results == []
