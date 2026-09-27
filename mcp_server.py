import json
import os
import re
import sqlite3
import subprocess
import urllib.request
from pathlib import Path
from typing import Any

from fastmcp import FastMCP

DB_PATH = Path(__file__).parent / "family_hub.db"

mcp = FastMCP("family-hub")


def _gateway_auth() -> dict[str, str]:
    """门面对 /v1/* 一律要求 Bearer(此前不带鉴权 → 恒 401)。env → macOS Keychain(aetherforge-gateway)。"""
    key = os.environ.get("LLM_GATEWAY_KEY") or os.environ.get("AETHERFORGE_API_KEY") or ""
    if not key:
        try:
            out = subprocess.run(
                ["security", "find-generic-password", "-s", "aetherforge-gateway", "-w"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            key = out.stdout.strip() if out.returncode == 0 else ""
        except (OSError, subprocess.TimeoutExpired):
            key = ""
    return {"Authorization": f"Bearer {key}"} if key else {}


def _get_db():
    conn = sqlite3.connect(str(DB_PATH), timeout=2.0)
    conn.row_factory = sqlite3.Row
    return conn


def _extract_json_array(raw_content: str) -> list[dict[str, Any]]:
    """Extract the first JSON array from an LLM response."""
    text = (raw_content or "").strip()
    if not text:
        raise ValueError("empty gateway content")

    fenced = re.search(r"```(?:json)?\s*(\[[\s\S]*?\])\s*```", text, re.IGNORECASE)
    if fenced:
        text = fenced.group(1).strip()

    if text.startswith("["):
        return json.loads(text)

    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        raise ValueError(f"no JSON array found in gateway content: {text[:120]}")
    return json.loads(text[start : end + 1])


def _export_to_gbrain(event_data: dict) -> None:
    """Export family-hub events to gbrain knowledge base (non-blocking, best-effort).

    Uses BOS URI bos://memory/gbrain/put_page via agora MCP proxy.
    Falls back to direct HTTP if agora is unavailable.
    """
    try:
        gbrain_url = os.environ.get("GBRAIN_URL", "http://localhost:3000")
        page_data = {
            "title": f"family-hub: {event_data.get('event', 'unknown')}",
            "content": json.dumps(event_data, ensure_ascii=False),
            "source": "family-hub",
            "tags": ["family-hub", event_data.get("event", "event")],
        }
        req = urllib.request.Request(
            f"{gbrain_url}/api/pages",
            data=json.dumps(page_data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=3.0)
    except Exception:  # non-blocking, best-effort export
        pass  # gbrain not available — quest completion is not blocked


def _normalize_generated_quest(raw: dict[str, Any], assignee: str) -> dict[str, Any]:
    reward = raw.get("reward", 50)
    try:
        reward_int = int(reward)
    except (TypeError, ValueError):
        reward_int = 50
    if reward_int <= 0:
        reward_int = 50

    quest_type = str(raw.get("type", "responsibility")).strip().lower() or "responsibility"
    if quest_type not in {"wisdom", "responsibility", "learning", "household"}:
        quest_type = "responsibility"

    title = str(raw.get("title", "")).strip() or f"{assignee} 的智能任务"
    return {
        "title": title,
        "type": quest_type,
        "reward": reward_int,
        "assignee": assignee,
    }


@mcp.tool()
def get_health() -> dict:
    """Check health of the family hub database."""
    if not DB_PATH.exists():
        return {"error": "DB not found"}
    try:
        with _get_db() as conn:
            conn.execute("SELECT 1").fetchone()
        return {"status": "ok"}
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def get_profiles() -> list[dict]:
    """Get all family member profiles."""
    with _get_db() as conn:
        profiles = conn.execute(
            "SELECT role, name, level, wisdomPoints, responsibilityPoints, inventory FROM profiles"
        ).fetchall()
    return [dict(p) for p in profiles]


@mcp.tool()
def get_active_quests() -> list[dict]:
    """Get all active (uncompleted) quests."""
    with _get_db() as conn:
        quests = conn.execute(
            "SELECT id, title, type, reward, completed, assignee FROM quests WHERE completed = 0"
        ).fetchall()
    return [dict(q) for q in quests]


@mcp.tool()
def create_quest(title: str, type: str, reward: int, assignee: str) -> dict:
    """Create a new quest for a family member.

    When OMO_GOVERNANCE_ENABLED=1, also registers the quest as an OMO task
    via ingress-task broker for governance visibility.
    """
    with _get_db() as conn:
        cur = conn.execute(
            "INSERT INTO quests (title, type, reward, completed, assignee) VALUES (?, ?, ?, 0, ?)",
            (title, type, reward, assignee),
        )
        quest_id = cur.lastrowid
        conn.commit()

    # G2 fix: Route to OMO governance if enabled (non-blocking, best-effort)
    if os.environ.get("OMO_GOVERNANCE_ENABLED"):
        try:
            import subprocess

            workspace = Path(__file__).resolve().parents[2]
            task_id = f"FAMILY-QUEST-{quest_id}"
            subprocess.run(
                [
                    "python3",
                    "-m",
                    "omo.cli",
                    "ingress-task",
                    "--id",
                    task_id,
                    "--title",
                    f"[家庭] {title}",
                    "--assignee",
                    assignee,
                    "--priority",
                    "P3",
                    "--deliverable",
                    f"family-hub quest #{quest_id}",
                    "--workspace-root",
                    str(workspace),
                ],
                capture_output=True,
                check=False,  # best-effort: OMO optional, non-blocking
                timeout=5,
                cwd=str(workspace / "projects" / "omo"),
            )
        except Exception:
            pass  # Non-blocking: family-hub works standalone, OMO is optional

    return {"id": quest_id, "status": "created"}


@mcp.tool()
def complete_quest(quest_id: int) -> dict:
    """Mark a quest as completed and award the assignee."""
    with _get_db() as conn:
        # Check if quest exists and is active
        quest = conn.execute(
            "SELECT reward, assignee, type FROM quests WHERE id = ? AND completed = 0", (quest_id,)
        ).fetchone()
        if not quest:
            return {"error": "Quest not found or already completed"}

        reward = quest["reward"]
        assignee = quest["assignee"]
        q_type = quest["type"]

        # Mark as completed
        conn.execute("UPDATE quests SET completed = 1 WHERE id = ?", (quest_id,))

        # Update profile points based on type
        if q_type in ("household", "responsibility"):
            conn.execute(
                "UPDATE profiles SET responsibilityPoints = responsibilityPoints + ? WHERE role = ?", (reward, assignee)
            )
        elif q_type in ("learning", "wisdom"):
            conn.execute("UPDATE profiles SET wisdomPoints = wisdomPoints + ? WHERE role = ?", (reward, assignee))
        else:
            # Fallback
            conn.execute(
                "UPDATE profiles SET responsibilityPoints = responsibilityPoints + ? WHERE role = ?", (reward, assignee)
            )

        # Update level logic (simple: every 100 total points = 1 level)
        conn.execute(
            """
            UPDATE profiles
            SET level = 1 + (wisdomPoints + responsibilityPoints) / 100
            WHERE role = ?
        """,
            (assignee,),
        )

        # Log action
        conn.execute(
            "INSERT INTO logs (message, type, timestamp) VALUES (?, ?, datetime('now'))",
            (f"{assignee} completed quest: {quest_id} for {reward} points", "quest_completion"),
        )
        conn.commit()

    # Export completed quest to gbrain knowledge base (if available)
    _export_to_gbrain({"event": "quest_completed", "quest_id": quest_id, "assignee": assignee, "reward": reward})

    return {"status": "success", "reward": reward, "assignee": assignee}


@mcp.tool()
def generate_smart_quests(assignee: str) -> dict:
    """Use the L0 LLM Gateway (via HTTP) to dynamically generate personalized quests."""
    prompt = (
        f"You are a family quest generator. The assignee is '{assignee}'. "
        f"Generate exactly 2 fun daily tasks (1 for wisdom, 1 for responsibility) "
        f"for this family member. Format the output as JSON: "
        f'[{{"title": "task title", "type": "wisdom/responsibility", "reward": 50}}]'
        f" Do not output anything other than the JSON array."
    )

    # Payload for llm-gateway HTTP API
    llm_gateway_url = os.environ.get("LLM_GATEWAY_URL", "http://127.0.0.1:4000")
    data = json.dumps({"model": "fast", "messages": [{"role": "user", "content": prompt}]}).encode("utf-8")
    req = urllib.request.Request(
        f"{llm_gateway_url}/v1/chat/completions",
        data=data,
        headers={"Content-Type": "application/json", **_gateway_auth()},
    )

    try:
        # 快档冷加载可达数十秒, 10s 超时会把正常请求判成失败
        with urllib.request.urlopen(req, timeout=180.0) as response:
            resp_body = json.loads(response.read().decode("utf-8"))

        if "error" in resp_body:
            return {"error": f"LLM Gateway returned error: {resp_body['error']}"}

        content = (resp_body.get("choices") or [{}])[0].get("message", {}).get("content", "")
        quests = [_normalize_generated_quest(item, assignee) for item in _extract_json_array(content)]
        if not quests:
            return {"error": "LLM Gateway returned an empty quest list"}

        # Save to DB
        created_ids = []
        with _get_db() as conn:
            for q in quests:
                cur = conn.execute(
                    "INSERT INTO quests (title, type, reward, completed, assignee) VALUES (?, ?, ?, 0, ?)",
                    (q["title"], q["type"], q["reward"], q["assignee"]),
                )
                created_ids.append(cur.lastrowid)
            conn.commit()

        return {
            "status": "success",
            "provider": resp_body.get("model", "unknown"),
            "created_ids": created_ids,
            "created_quests": quests,
        }
    except Exception as e:
        return {"error": f"LLM generation failed: {e!s}. Make sure llm-gateway is running on port 9290."}


if __name__ == "__main__":
    mcp.run()
