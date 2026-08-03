import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import mcp_server


class _FakeResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def read(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class GenerateSmartQuestsTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self.db_path = Path(self._tmpdir.name) / "family_hub.db"
        self._db_patch = patch.object(mcp_server, "DB_PATH", self.db_path)
        self._db_patch.start()
        self._init_db()

    def tearDown(self) -> None:
        self._db_patch.stop()
        self._tmpdir.cleanup()

    def _init_db(self) -> None:
        conn = sqlite3.connect(self.db_path)
        conn.execute(
            """
            CREATE TABLE quests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                type TEXT,
                reward INTEGER,
                completed INTEGER DEFAULT 0,
                assignee TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE profiles (
                role TEXT PRIMARY KEY,
                name TEXT,
                level INTEGER DEFAULT 1,
                wisdomPoints INTEGER DEFAULT 0,
                responsibilityPoints INTEGER DEFAULT 0,
                inventory TEXT DEFAULT '[]'
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message TEXT,
                type TEXT,
                timestamp TEXT
            )
            """
        )
        conn.commit()
        conn.close()

    def test_extract_json_array_accepts_fenced_output(self) -> None:
        content = """```json
        [{"title":"读绘本","type":"wisdom","reward":40}]
        ```"""
        quests = mcp_server._extract_json_array(content)
        self.assertEqual(quests[0]["title"], "读绘本")

    def test_generate_smart_quests_persists_normalized_items(self) -> None:
        payload = {
            "content": """这里是任务：
```json
[
  {"title": "读绘本", "type": "wisdom", "reward": "40"},
  {"title": "整理玩具", "type": "household", "reward": 60}
]
```""",
            "model": "mock-model",
        }

        with patch("urllib.request.urlopen", return_value=_FakeResponse(payload)):
            result = mcp_server.generate_smart_quests("kid")

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["provider"], "mock-model")
        self.assertEqual(len(result["created_ids"]), 2)
        self.assertEqual(result["created_quests"][0]["reward"], 40)

        with mcp_server._get_db() as conn:
            rows = conn.execute(
                "SELECT title, type, reward, assignee FROM quests ORDER BY id"
            ).fetchall()
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["assignee"], "kid")
        self.assertEqual(rows[1]["type"], "household")


if __name__ == "__main__":
    unittest.main()
