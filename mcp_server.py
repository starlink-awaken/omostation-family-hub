import sys
import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "family_hub.db"

def handle_health():
    if not DB_PATH.exists():
        return {"error": "DB not found"}
    
    try:
        conn = sqlite3.connect(str(DB_PATH), timeout=2.0)
        conn.row_factory = sqlite3.Row
        profiles = conn.execute("SELECT role, name, level, wisdomPoints, responsibilityPoints, inventory FROM profiles").fetchall()
        quests = conn.execute("SELECT title, type, reward, completed, assignee FROM quests WHERE completed = 0").fetchall()
        conn.close()
        
        return {
            "profiles": [dict(p) for p in profiles],
            "active_quests": [dict(q) for q in quests]
        }
    except Exception as e:
        return {"error": str(e)}

def main():
    # POC Custom Protocol loop
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            req = json.loads(line)
            req_id = req.get("request_id")
            action = req.get("action")
            
            if action == "health":
                result = handle_health()
                sys.stdout.write(json.dumps({
                    "request_id": req_id,
                    "status": "ok" if "error" not in result else "error",
                    "result": result
                }) + "\n")
            else:
                sys.stdout.write(json.dumps({
                    "request_id": req_id,
                    "status": "error",
                    "error": f"Unknown action: {action}"
                }) + "\n")
            sys.stdout.flush()
        except Exception as e:
            sys.stdout.write(json.dumps({"status": "error", "error": str(e)}) + "\n")
            sys.stdout.flush()

if __name__ == "__main__":
    main()
