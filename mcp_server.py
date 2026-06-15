import sqlite3
from pathlib import Path
from fastmcp import FastMCP
from typing import List

DB_PATH = Path(__file__).parent / "family_hub.db"

mcp = FastMCP("family-hub")

def _get_db():
    conn = sqlite3.connect(str(DB_PATH), timeout=2.0)
    conn.row_factory = sqlite3.Row
    return conn

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
def get_profiles() -> List[dict]:
    """Get all family member profiles."""
    with _get_db() as conn:
        profiles = conn.execute("SELECT role, name, level, wisdomPoints, responsibilityPoints, inventory FROM profiles").fetchall()
    return [dict(p) for p in profiles]

@mcp.tool()
def get_active_quests() -> List[dict]:
    """Get all active (uncompleted) quests."""
    with _get_db() as conn:
        quests = conn.execute("SELECT id, title, type, reward, completed, assignee FROM quests WHERE completed = 0").fetchall()
    return [dict(q) for q in quests]

@mcp.tool()
def create_quest(title: str, type: str, reward: int, assignee: str) -> dict:
    """Create a new quest for a family member."""
    with _get_db() as conn:
        cur = conn.execute(
            "INSERT INTO quests (title, type, reward, completed, assignee) VALUES (?, ?, ?, 0, ?)",
            (title, type, reward, assignee)
        )
        conn.commit()
        return {"id": cur.lastrowid, "status": "created"}

@mcp.tool()
def complete_quest(quest_id: int) -> dict:
    """Mark a quest as completed and award the assignee."""
    with _get_db() as conn:
        # Check if quest exists and is active
        quest = conn.execute("SELECT reward, assignee, type FROM quests WHERE id = ? AND completed = 0", (quest_id,)).fetchone()
        if not quest:
            return {"error": "Quest not found or already completed"}
            
        reward = quest["reward"]
        assignee = quest["assignee"]
        q_type = quest["type"]
        
        # Mark as completed
        conn.execute("UPDATE quests SET completed = 1 WHERE id = ?", (quest_id,))
        
        # Update profile points based on type
        if q_type in ("household", "responsibility"):
            conn.execute("UPDATE profiles SET responsibilityPoints = responsibilityPoints + ? WHERE role = ?", (reward, assignee))
        elif q_type in ("learning", "wisdom"):
            conn.execute("UPDATE profiles SET wisdomPoints = wisdomPoints + ? WHERE role = ?", (reward, assignee))
        else:
            # Fallback
            conn.execute("UPDATE profiles SET responsibilityPoints = responsibilityPoints + ? WHERE role = ?", (reward, assignee))
            
        # Update level logic (simple: every 100 total points = 1 level)
        conn.execute("""
            UPDATE profiles 
            SET level = 1 + (wisdomPoints + responsibilityPoints) / 100 
            WHERE role = ?
        """, (assignee,))
            
        # Log action
        conn.execute("INSERT INTO logs (message, type, timestamp) VALUES (?, ?, datetime('now'))", 
                     (f"{assignee} completed quest: {quest_id} for {reward} points", "quest_completion"))
        conn.commit()
    return {"status": "success", "reward": reward, "assignee": assignee}

if __name__ == "__main__":
    mcp.run()
