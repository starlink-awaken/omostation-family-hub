"""Integration tests for family-hub quest MCP server.

Tests end-to-end flows: quest lifecycle, OMO governance subprocess,
gbrain HTTP export, and LLM gateway generation.
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import http.server
from unittest.mock import patch, MagicMock
from pathlib import Path

import pytest

import mcp_server as qs


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def real_db(tmp_path, monkeypatch):
    """Create a real SQLite DB with full schema and fresh state."""
    db_path = tmp_path / "integration_quests.db"
    monkeypatch.setattr(qs, "DB_PATH", db_path)

    conn = sqlite3.connect(str(db_path))
    conn.executescript("""
        CREATE TABLE quests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            type TEXT NOT NULL,
            reward INTEGER DEFAULT 50,
            completed INTEGER DEFAULT 0,
            assignee TEXT NOT NULL
        );
        CREATE TABLE profiles (
            role TEXT PRIMARY KEY,
            name TEXT,
            level INTEGER DEFAULT 1,
            wisdomPoints INTEGER DEFAULT 0,
            responsibilityPoints INTEGER DEFAULT 0,
            inventory TEXT DEFAULT '{}'
        );
        CREATE TABLE logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message TEXT,
            type TEXT,
            timestamp TEXT
        );
    """)
    conn.commit()
    conn.close()

    return db_path


@pytest.fixture
def family_hub(real_db):
    """Initialize a family hub with parent + child profiles."""
    conn = sqlite3.connect(str(real_db))
    conn.executemany(
        "INSERT INTO profiles (role, name, level, wisdomPoints, responsibilityPoints) VALUES (?, ?, ?, ?, ?)",
        [
            ("parent", "爸爸", 1, 0, 0),
            ("child", "小明", 1, 0, 0),
        ],
    )
    conn.commit()
    conn.close()
    return real_db


@pytest.fixture
def mock_http_server():
    """Start a lightweight HTTP server to simulate gbrain/LLM endpoints."""
    received_requests = []

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_POST(self):
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            received_requests.append({"path": self.path, "body": body.decode()})
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')

        def do_GET(self):
            received_requests.append({"path": "GET " + self.path})
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "ok"}')

        def log_message(self, format, *args):
            pass  # suppress logs

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    yield f"http://127.0.0.1:{port}", received_requests

    server.shutdown()


# ---------------------------------------------------------------------------
# Full quest lifecycle
# ---------------------------------------------------------------------------

class TestQuestLifecycle:
    """Create → activate → complete → verify consequences."""

    def test_full_lifecycle_wisdom_points(self, family_hub):
        """Parent earns wisdom points from a wisdom quest."""
        # Create quest
        created = qs.create_quest("读一本书", "wisdom", 100, "parent")
        assert created["status"] == "created"
        quest_id = created["id"]

        # Quest is active
        active = qs.get_active_quests()
        assert len(active) == 1
        assert active[0]["title"] == "读一本书"

        # Complete quest
        result = qs.complete_quest(quest_id)
        assert result["status"] == "success"
        assert result["reward"] == 100

        # Quest no longer active
        active = qs.get_active_quests()
        assert len(active) == 0

        # Profile updated
        profiles = qs.get_profiles()
        parent = next(p for p in profiles if p["role"] == "parent")
        assert parent["wisdomPoints"] == 100

    def test_full_lifecycle_responsibility_points(self, family_hub):
        """Child earns responsibility points from a household quest."""
        qs.create_quest("洗碗", "household", 60, "child")
        active = qs.get_active_quests()
        assert len(active) == 1

        result = qs.complete_quest(active[0]["id"])
        assert result["status"] == "success"

        profiles = qs.get_profiles()
        child = next(p for p in profiles if p["role"] == "child")
        assert child["responsibilityPoints"] == 60
        # Wisdom should not be affected
        assert child["wisdomPoints"] == 0

    def test_level_up_after_threshold(self, family_hub):
        """Level increases after crossing XP threshold."""
        quests = []
        for i in range(5):
            created = qs.create_quest(f"Quest {i}", "wisdom", 100, "parent")
            quests.append(created["id"])

        for qid in quests:
            qs.complete_quest(qid)

        profiles = qs.get_profiles()
        parent = next(p for p in profiles if p["role"] == "parent")
        # 5 * 100 = 500 xp → level = 1 + (500 / 100) = 6
        assert parent["level"] == 6
        assert parent["wisdomPoints"] == 500

    def test_multiple_quest_types_mixed_points(self, family_hub):
        """Wisdom quests award wisdomPoints, household awards responsibilityPoints."""
        q1 = qs.create_quest("学习AI", "wisdom", 80, "parent")
        q2 = qs.create_quest("打扫", "household", 40, "parent")
        q3 = qs.create_quest("做作业", "learning", 60, "parent")

        for q in [q1, q2, q3]:
            qs.complete_quest(q["id"])

        profiles = qs.get_profiles()
        parent = next(p for p in profiles if p["role"] == "parent")
        # wisdom: q1) + learning(60) = 140
        assert parent["wisdomPoints"] == 140
        # responsibility: q2(40) = 40
        assert parent["responsibilityPoints"] == 40


# ---------------------------------------------------------------------------
# OMO governance subprocess integration
# ---------------------------------------------------------------------------

class TestOmoGovernanceIntegration:
    def test_create_quest_triggers_omo_subprocess(self, family_hub, monkeypatch):
        """When OMO_GOVERNANCE_ENABLED=1, quest creation spawns subprocess."""
        monkeypatch.setenv("OMO_GOVERNANCE_ENABLED", "1")

        with patch("subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout="Task created")
            result = qs.create_quest("治理任务", "wisdom", 50, "parent")

        assert result["status"] == "created"
        # Verify subprocess was called for OMO governance
        assert mock_run.called

    def test_create_quest_without_governance(self, family_hub, monkeypatch):
        """Without env var, no subprocess call."""
        monkeypatch.delenv("OMO_GOVERNANCE_ENABLED", raising=False)

        with patch("subprocess.run") as mock_run:
            result = qs.create_quest("普通任务", "wisdom", 50, "parent")

        assert result["status"] == "created"
        assert not mock_run.called


# ---------------------------------------------------------------------------
# gbrain HTTP export integration
# ---------------------------------------------------------------------------

class TestGbrainExportIntegration:
    def test_export_posts_to_gbrain(self, family_hub, mock_http_server):
        """_export_to_gbrain sends POST to gbrain with event data."""
        gbrain_url, received = mock_http_server
        os.environ["GBRAIN_URL"] = gbrain_url

        event_data = {"event": "quest_completed", "title": "Test Quest", "reward": 100}
        qs._export_to_gbrain(event_data)

        # Verify HTTP POST was made
        assert len(received) == 1
        assert received[0]["path"] == "/api/pages"
        body = json.loads(received[0]["body"])
        assert "family-hub: quest_completed" in body["title"]
        assert "family-hub" in body["tags"]

    def test_export_silently_fails_on_connection_error(self, family_hub):
        """gbrain unavailable does not raise — export is best-effort."""
        os.environ["GBRAIN_URL"] = "http://localhost:1"

        # Should NOT raise
        qs._export_to_gbrain({"event": "test"})

    def test_complete_quest_exports_to_gbrain(self, family_hub, mock_http_server):
        """Quest completion triggers gbrain export."""
        gbrain_url, received = mock_http_server
        os.environ["GBRAIN_URL"] = gbrain_url

        # Enable gbrain export on completion
        created = qs.create_quest("可导出的任务", "wisdom", 100, "parent")
        qs.complete_quest(created["id"])

        # At least one HTTP request was made (the gbrain export)
        assert len(received) >= 1


# ---------------------------------------------------------------------------
# LLM gateway smart quest generation
# ---------------------------------------------------------------------------

class TestSmartQuestGeneration:
    def test_generate_creates_quests_from_llm_response(self, family_hub, mock_http_server):
        """Smart quest generation parses LLM response and creates quests."""
        llm_url, received = mock_http_server
        os.environ["FAMILY_HUB_LLM_URL"] = llm_url + "/generate"

        # The mock server returns {"status": "ok"} for any request
        # We need to mock the actual LLM response content
        llm_response = json.dumps({
            "content": '[{"title": "AI学习", "type": "wisdom", "reward": 75}, {"title": "打扫房间", "type": "household", "reward": 30}]',
            "model": "test-model",
        })

        import urllib.request
        original_urlopen = urllib.request.urlopen

        class MockResponse:
            def read(self):
                return llm_response.encode()
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass

        with patch("urllib.request.urlopen", side_effect=lambda req, **kw: MockResponse()):
            result = qs.generate_smart_quests("parent")

        assert result["status"] == "success"
        assert len(result["created_ids"]) == 2

        # Verify quests persisted
        active = qs.get_active_quests()
        assert len(active) == 2

    def test_generate_handles_invalid_llm_json(self, family_hub):
        """Invalid LLM response returns error without crashing."""
        import urllib.request

        class MockResponse:
            def read(self):
                return b'{"error": "timeout"}'
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass

        with patch("urllib.request.urlopen", side_effect=lambda req, **kw: MockResponse()):
            result = qs.generate_smart_quests("parent")

        assert "error" in result


# ---------------------------------------------------------------------------
# FastMCP tool integration (end-to-end via MCP client)
# ---------------------------------------------------------------------------

class TestMCPToolIntegration:
    def test_get_health_returns_ok(self, family_hub):
        result = qs.get_health()
        assert result["status"] == "ok"

    def test_get_profiles_returns_family(self, family_hub):
        result = qs.get_profiles()
        assert len(result) == 2
        roles = {p["role"] for p in result}
        assert roles == {"parent", "child"}

    def test_get_active_quests_empty_initially(self, family_hub):
        result = qs.get_active_quests()
        assert result == []

    def test_tool_chain_create_list_complete(self, family_hub):
        """Full chain: create → list → complete → verify."""
        # Create
        qs.create_quest("测试任务", "wisdom", 50, "parent")

        # List
        active = qs.get_active_quests()
        assert len(active) == 1

        # Complete
        qs.complete_quest(active[0]["id"])

        # Verify
        active = qs.get_active_quests()
        assert len(active) == 0
