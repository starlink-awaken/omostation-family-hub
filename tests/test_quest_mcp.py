"""Unit tests for family-hub quest MCP server."""

from __future__ import annotations

import json
import sqlite3
from unittest.mock import MagicMock, patch

import pytest

import mcp_server as qs


@pytest.fixture
def tmp_db(tmp_path, monkeypatch):
    """Create a temporary quest database."""
    db_path = tmp_path / "test_quests.db"
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


class TestGetHealth:
    def test_health_ok(self, tmp_db):
        result = qs.get_health()
        assert result["status"] == "ok"

    def test_health_no_db(self, tmp_path, monkeypatch):
        monkeypatch.setattr(qs, "DB_PATH", tmp_path / "nonexistent.db")
        result = qs.get_health()
        assert "error" in result


class TestGetProfiles:
    def test_get_profiles_empty(self, tmp_db):
        result = qs.get_profiles()
        assert result == []

    def test_get_profiles_with_data(self, tmp_db):
        conn = sqlite3.connect(str(tmp_db))
        conn.execute("INSERT INTO profiles (role, name, level) VALUES ('parent', 'Test', 5)")
        conn.commit()
        conn.close()

        result = qs.get_profiles()
        assert len(result) == 1
        assert result[0]["role"] == "parent"
        assert result[0]["level"] == 5


class TestGetActiveQuests:
    def test_get_active_quests_empty(self, tmp_db):
        result = qs.get_active_quests()
        assert result == []

    def test_get_active_quests_filters_completed(self, tmp_db):
        conn = sqlite3.connect(str(tmp_db))
        conn.execute("INSERT INTO quests (title, type, assignee) VALUES ('Active', 'wisdom', 'parent')")
        conn.execute("INSERT INTO quests (title, type, assignee, completed) VALUES ('Done', 'wisdom', 'parent', 1)")
        conn.commit()
        conn.close()

        result = qs.get_active_quests()
        assert len(result) == 1
        assert result[0]["title"] == "Active"


class TestCreateQuest:
    def test_create_quest_basic(self, tmp_db):
        result = qs.create_quest("Test Quest", "wisdom", 100, "parent")
        assert result["status"] == "created"
        assert "id" in result

    def test_create_quest_persists(self, tmp_db):
        result = qs.create_quest("Persisted", "responsibility", 75, "child")
        conn = sqlite3.connect(str(tmp_db))
        row = conn.execute("SELECT * FROM quests WHERE id = ?", (result["id"],)).fetchone()
        conn.close()
        assert row is not None
        assert row[1] == "Persisted"
        assert row[2] == "responsibility"
        assert row[3] == 75

    def test_create_quest_with_omo_governance(self, tmp_db, monkeypatch):
        monkeypatch.setenv("OMO_GOVERNANCE_ENABLED", "1")
        with patch("subprocess.run") as _mock_run:
            result = qs.create_quest("Governed Quest", "wisdom", 50, "parent")
            assert result["status"] == "created"
            # OMO governance is non-blocking; subprocess may or may not be called


class TestCompleteQuest:
    def test_complete_quest_success(self, tmp_db):
        conn = sqlite3.connect(str(tmp_db))
        conn.execute("INSERT INTO profiles (role, name) VALUES ('parent', 'Test')")
        cur = conn.execute("INSERT INTO quests (title, type, reward, assignee) VALUES ('Q1', 'wisdom', 100, 'parent')")
        quest_id = cur.lastrowid
        conn.commit()
        conn.close()

        result = qs.complete_quest(quest_id)  # type: ignore[reportArgumentType]
        assert result["status"] == "success"
        assert result["reward"] == 100

    def test_complete_quest_not_found(self, tmp_db):
        result = qs.complete_quest(9999)
        assert "error" in result

    def test_complete_quest_already_completed(self, tmp_db):
        conn = sqlite3.connect(str(tmp_db))
        cur = conn.execute(
            "INSERT INTO quests (title, type, reward, assignee, completed) VALUES ('Done', 'wisdom', 50, 'parent', 1)"
        )
        quest_id = cur.lastrowid
        conn.commit()
        conn.close()

        result = qs.complete_quest(quest_id)  # type: ignore[reportArgumentType]
        assert "error" in result

    def test_complete_quest_awards_wisdom_points(self, tmp_db):
        conn = sqlite3.connect(str(tmp_db))
        conn.execute("INSERT INTO profiles (role, name) VALUES ('parent', 'Test')")
        cur = conn.execute(
            "INSERT INTO quests (title, type, reward, assignee) VALUES ('Learn', 'learning', 80, 'parent')"
        )
        quest_id = cur.lastrowid
        conn.commit()
        conn.close()

        qs.complete_quest(quest_id)  # type: ignore[reportArgumentType]

        conn = sqlite3.connect(str(tmp_db))
        profile = conn.execute("SELECT * FROM profiles WHERE role = 'parent'").fetchone()
        conn.close()
        assert profile[3] == 80  # wisdomPoints column

    def test_complete_quest_awards_responsibility_points(self, tmp_db):
        conn = sqlite3.connect(str(tmp_db))
        conn.execute("INSERT INTO profiles (role, name) VALUES ('child', 'Test')")
        cur = conn.execute(
            "INSERT INTO quests (title, type, reward, assignee) VALUES ('Chore', 'household', 60, 'child')"
        )
        quest_id = cur.lastrowid
        conn.commit()
        conn.close()

        qs.complete_quest(quest_id)  # type: ignore[reportArgumentType]

        conn = sqlite3.connect(str(tmp_db))
        profile = conn.execute("SELECT * FROM profiles WHERE role = 'child'").fetchone()
        conn.close()
        assert profile[4] == 60  # responsibilityPoints column

    def test_complete_quest_updates_level(self, tmp_db):
        conn = sqlite3.connect(str(tmp_db))
        conn.execute("INSERT INTO profiles (role, name, wisdomPoints) VALUES ('parent', 'Test', 150)")
        cur = conn.execute(
            "INSERT INTO quests (title, type, reward, assignee) VALUES ('LevelUp', 'wisdom', 100, 'parent')"
        )
        quest_id = cur.lastrowid
        conn.commit()
        conn.close()

        qs.complete_quest(quest_id)  # type: ignore[reportArgumentType]

        conn = sqlite3.connect(str(tmp_db))
        profile = conn.execute("SELECT * FROM profiles WHERE role = 'parent'").fetchone()
        conn.close()
        # Level = 1 + (250 / 100) = 3
        assert profile[2] == 3  # level column


class TestExtractJsonArray:
    def test_plain_json(self):
        result = qs._extract_json_array('[{"a": 1}]')
        assert result == [{"a": 1}]

    def test_fenced_json(self):
        result = qs._extract_json_array('```json\n[{"b": 2}]\n```')
        assert result == [{"b": 2}]

    def test_embedded_json(self):
        result = qs._extract_json_array('Here is the data: [{"c": 3}] done')
        assert result == [{"c": 3}]

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="empty"):
            qs._extract_json_array("")

    def test_no_array_raises(self):
        with pytest.raises(ValueError, match="no JSON array"):
            qs._extract_json_array("just text")


class TestNormalizeGeneratedQuest:
    def test_valid_quest(self):
        result = qs._normalize_generated_quest({"title": "Test", "type": "wisdom", "reward": 100}, "parent")
        assert result["title"] == "Test"
        assert result["type"] == "wisdom"
        assert result["reward"] == 100
        assert result["assignee"] == "parent"

    def test_invalid_reward_defaults(self):
        result = qs._normalize_generated_quest({"title": "T", "type": "wisdom", "reward": -10}, "parent")
        assert result["reward"] == 50

    def test_invalid_type_defaults(self):
        result = qs._normalize_generated_quest({"title": "T", "type": "invalid", "reward": 50}, "parent")
        assert result["type"] == "responsibility"

    def test_empty_title_defaults(self):
        result = qs._normalize_generated_quest({"title": "  ", "type": "wisdom", "reward": 50}, "parent")
        assert "智能任务" in result["title"]


class TestExportToGbrain:
    def test_export_success(self):
        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_urlopen.return_value.__enter__ = MagicMock(return_value=MagicMock(status=200))
            mock_urlopen.return_value.__exit__ = MagicMock(return_value=False)
            qs._export_to_gbrain({"event": "test"})
            assert mock_urlopen.called

    def test_export_fails_silently(self):
        with patch("urllib.request.urlopen", side_effect=Exception("unavailable")):
            # Should not raise
            qs._export_to_gbrain({"event": "test"})


class TestGenerateSmartQuests:
    def test_generate_success(self, tmp_db):
        mock_response = {
            "content": '[{"title": "AI Quest", "type": "wisdom", "reward": 75}]',
            "model": "test-model",
        }
        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_cm = MagicMock()
            mock_cm.__enter__ = MagicMock(return_value=MagicMock(read=lambda: json.dumps(mock_response).encode()))
            mock_cm.__exit__ = MagicMock(return_value=False)
            mock_urlopen.return_value = mock_cm

            result = qs.generate_smart_quests("parent")

        assert result["status"] == "success"
        assert len(result["created_ids"]) == 1

    def test_generate_llm_error(self, tmp_db):
        mock_response = {"error": "timeout"}
        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_cm = MagicMock()
            mock_cm.__enter__ = MagicMock(return_value=MagicMock(read=lambda: json.dumps(mock_response).encode()))
            mock_cm.__exit__ = MagicMock(return_value=False)
            mock_urlopen.return_value = mock_cm

            result = qs.generate_smart_quests("parent")
        assert "error" in result

    def test_generate_http_failure(self, tmp_db):
        with patch("urllib.request.urlopen", side_effect=Exception("Connection refused")):
            result = qs.generate_smart_quests("parent")
        assert "error" in result
