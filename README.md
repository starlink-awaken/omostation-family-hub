# Family Hub

    > X · 家庭数字枢纽与本地家庭任务/数据服务
    > Metadata SSOT: [`../../docs/project-registry.yaml`](../../docs/project-registry.yaml)

    ## What It Owns

    家庭数字枢纽与本地家庭任务/数据服务.

    ## Quick Start

    ```bash
    uv sync
uv run pytest "tests/" -q
    ```

    ## Key Surfaces

    - `src/`
- `server.py`
- `data/`

    ## Documentation

    - Developer guide: [`AGENTS.md`](AGENTS.md)
    - AI context loader: [`CLAUDE.md`](CLAUDE.md) when present
    - Workspace architecture: [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md)
    - Layer placement: [`../../LAYER-INDEX.md`](../../LAYER-INDEX.md)

    ## SSOT Rules

    Runtime facts, counts, ports, health, and generated inventories are intentionally not maintained here. Use the workspace registries and project source as the truth.
