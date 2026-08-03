"""family-hub 测试 conftest

P3 work: mcp_server.py 在根目录, 不在 src/。pytest 跑时 sys.path 找不到。
pythonpath = ["."] 在 pyproject 已加, 但 uv_build 同时注入 src/ 路径,
可能导致 import 冲突 (sys.path 顺序: src > ".")。conftest 显式插根到 sys.path
第一位, 保证 import mcp_server 找到根目录版本。
"""

import sys
from pathlib import Path

# 把项目根目录插入 sys.path 第一位
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
