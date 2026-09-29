"""asset_audit — 家庭资产负债平水审计引擎 (BET-Y2Q3-T7-01).

提供:
  - BankStatementParser: 解析 CSV/OFX/PDF 银行流水
  - LargeExpenseDetector: 大额异常支出检测 (2σ 阈值)
  - ContractReviewer: 法务合同风险条款审查
  - MonthlyReportGenerator: 月度资产负债平水报表生成
"""

from __future__ import annotations

import csv
import io
import statistics
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

# ── Data Models ──

@dataclass
class Transaction:
    """单笔交易记录."""
    date: str
    amount: float  # 正数=收入, 负数=支出
    category: str
    description: str
    raw: dict[str, str] = field(default_factory=dict)


@dataclass
class AssetSnapshot:
    """资产快照."""
    date: str
    total_assets: float
    total_liabilities: float
    net_worth: float
    cash_flow: float
    debt_ratio: float


@dataclass
class RiskAlert:
    """风险预警."""
    level: str  # info / warning / critical
    type: str   # large_expense / contract_risk / anomaly
    message: str
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class ContractRisk:
    """合同风险点."""
    clause: str
    risk_type: str  # vague / unfair / missing
    severity: float  # 0-1
    suggestion: str


# ── Bank Statement Parser ──

# 国内银行导出常见表头(英文表头保持兼容)
_DATE_COLS = ("date", "Date", "交易日期", "记账日期", "日期", "交易时间")
_AMOUNT_COLS = ("amount", "Amount", "交易金额", "金额", "发生额")
_CATEGORY_COLS = ("category", "Category", "摘要", "交易类型", "用途")
_DESC_COLS = ("description", "Description", "对方户名", "交易对方", "备注", "附言")


def _first(row: dict[str, str], cols: tuple[str, ...]) -> str | None:
    for c in cols:
        v = row.get(c)
        if v is not None and str(v).strip() != "":
            return str(v).strip()
    return None


def _to_amount(raw: str | None) -> float | None:
    if raw is None or str(raw).strip() == "":
        return None
    try:
        return float(str(raw).replace(",", "").replace("¥", "").replace("￥", "").strip())
    except ValueError:
        return None


def _row_amount(row: dict[str, str]) -> float | None:
    """单列金额(正收负支), 或「收入金额/支出金额」分两列。"""
    single = _to_amount(_first(row, _AMOUNT_COLS))
    if single is not None:
        return single
    income, expense = _to_amount(row.get("收入金额")), _to_amount(row.get("支出金额"))
    if income is None and expense is None:
        return None
    return (income or 0.0) - abs(expense or 0.0)


class BankStatementParser:
    """银行流水解析器 (CSV/OFX/PDF).

    支持标准 CSV 格式 (date, amount, description, category).
    OFX 和 PDF 格式为占位实现，实际使用时需要接入对应解析库.
    """

    def parse(self, content: str, format: str = "csv") -> list[Transaction]:
        """解析流水内容，返回交易列表."""
        if format == "csv":
            return self._parse_csv(content)
        if format == "ofx":
            return self._parse_ofx(content)
        if format == "pdf":
            return self._parse_pdf(content)
        raise ValueError(f"不支持的格式: {format}")

    def parse_file(self, path: str | Path, format: str | None = None) -> list[Transaction]:
        """从文件解析流水."""
        path = Path(path)
        fmt = format or self._detect_format(path)
        content = path.read_text(encoding="utf-8", errors="replace")
        return self.parse(content, fmt)

    def _detect_format(self, path: Path) -> str:
        """根据文件扩展名检测格式."""
        suffix = path.suffix.lower()
        if suffix == ".csv":
            return "csv"
        if suffix in (".ofx", ".qfx"):
            return "ofx"
        if suffix == ".pdf":
            return "pdf"
        return "csv"  # 默认 CSV

    def _parse_csv(self, content: str) -> list[Transaction]:
        """解析 CSV 格式流水."""
        transactions: list[Transaction] = []
        reader = csv.DictReader(io.StringIO(content))

        for row in reader:
            amount = _row_amount(row)
            if amount is None:  # 没有金额列/金额无法解析: 跳过, 不能当 0 记(此前中文表头整月记成 0)
                continue
            tx = Transaction(
                date=_first(row, _DATE_COLS) or "",
                amount=amount,
                category=_first(row, _CATEGORY_COLS) or "uncategorized",
                description=_first(row, _DESC_COLS) or "",
                raw=dict(row),
            )
            transactions.append(tx)

        return transactions

    def _parse_ofx(self, content: str) -> list[Transaction]:
        """解析 OFX 格式流水 (占位实现)."""
        # TODO: 接入 ofxparse 库
        return []

    def _parse_pdf(self, content: str) -> list[Transaction]:
        """解析 PDF 格式流水 (占位实现)."""
        # TODO: 接入 pdfplumber 或 PyPDF2
        return []


# ── Large Expense Detector ──

class LargeExpenseDetector:
    """大额异常支出检测器.

    基于历史均值 + 标准差 (2σ) 检测异常大额支出.
    也支持固定阈值模式.
    """

    def __init__(self, sigma_threshold: float = 2.0, fixed_threshold: float | None = None):
        self.sigma_threshold = sigma_threshold
        self.fixed_threshold = fixed_threshold

    def detect(self, transactions: list[Transaction]) -> list[RiskAlert]:
        """检测大额异常支出."""
        expenses = [tx for tx in transactions if tx.amount < 0]
        if not expenses:
            return []

        amounts = [abs(tx.amount) for tx in expenses]

        if self.fixed_threshold is not None:
            return self._detect_fixed(expenses, self.fixed_threshold)

        return self._detect_sigma(expenses, amounts)

    def _detect_sigma(self, expenses: list[Transaction], amounts: list[float]) -> list[RiskAlert]:
        """基于标准差的检测."""
        if len(amounts) < 3:
            return []

        mean = statistics.mean(amounts)
        std = statistics.stdev(amounts)
        threshold = mean + self.sigma_threshold * std
        # 均值/标准差会被离群点本身拉大(样本少时最明显: 6 笔支出里 38000 的装修款拉高
        # 标准差后掩护了自己)。补一道修正 z 分数(中位数 + MAD, Iglewicz-Hoaglin 3.5), 任一命中即预警。
        median = statistics.median(amounts)
        mad = statistics.median(abs(a - median) for a in amounts)

        def _robust_outlier(a: float) -> bool:
            return mad > 0 and 0.6745 * (a - median) / mad > 3.5

        alerts: list[RiskAlert] = []
        for tx in expenses:
            if abs(tx.amount) > threshold or _robust_outlier(abs(tx.amount)):
                alerts.append(RiskAlert(
                    level="warning",
                    type="large_expense",
                    message=f"大额异常支出: {tx.description} ¥{abs(tx.amount):.2f} (阈值 ¥{threshold:.2f})",
                    details={
                        "amount": abs(tx.amount),
                        "threshold": threshold,
                        "mean": mean,
                        "std": std,
                        "date": tx.date,
                        "category": tx.category,
                    },
                ))

        return alerts

    def _detect_fixed(self, expenses: list[Transaction], threshold: float) -> list[RiskAlert]:
        """基于固定阈值的检测."""
        alerts: list[RiskAlert] = []
        for tx in expenses:
            if abs(tx.amount) > threshold:
                alerts.append(RiskAlert(
                    level="warning",
                    type="large_expense",
                    message=f"大额支出: {tx.description} ¥{abs(tx.amount):.2f} (阈值 ¥{threshold:.2f})",
                    details={
                        "amount": abs(tx.amount),
                        "threshold": threshold,
                        "date": tx.date,
                        "category": tx.category,
                    },
                ))

        return alerts


# ── Contract Reviewer ──

class ContractReviewer:
    """法务合同风险条款审查器.

    基于规则匹配检测模糊条款、违约风险与不公平条款.
    实际使用时可接入 LLM 增强检测.
    """

    # 风险关键词模式
    RISK_PATTERNS: list[tuple[str, str, float]] = [
        # (关键词, 风险类型, 严重度)
        ("单方面", "unfair", 0.7),
        ("最终解释权", "unfair", 0.8),
        ("不可抗力", "vague", 0.5),
        ("合理期限", "vague", 0.4),
        ("重大损失", "vague", 0.5),
        ("违约金", "penalty", 0.6),
        ("自动续约", "unfair", 0.6),
        ("免责", "unfair", 0.7),
        ("概不负责", "unfair", 0.9),
        ("随时调整", "unfair", 0.7),
    ]

    def review(self, contract_text: str) -> list[ContractRisk]:
        """审查合同文本，返回风险点列表."""
        risks: list[ContractRisk] = []

        for pattern, risk_type, severity in self.RISK_PATTERNS:
            if pattern in contract_text:
                # 找到上下文
                idx = contract_text.find(pattern)
                start = max(0, idx - 20)
                end = min(len(contract_text), idx + len(pattern) + 20)
                clause = contract_text[start:end]

                risks.append(ContractRisk(
                    clause=f"...{clause}...",
                    risk_type=risk_type,
                    severity=severity,
                    suggestion=self._suggest(risk_type, pattern),
                ))

        return risks

    def _suggest(self, risk_type: str, pattern: str) -> str:
        """根据风险类型给出建议."""
        suggestions = {
            "unfair": f"建议修改或删除 '{pattern}' 条款，该条款可能显失公平",
            "vague": f"建议明确 '{pattern}' 的具体定义和标准，避免歧义",
            "penalty": f"建议核实 '{pattern}' 条款的金额是否合理",
        }
        return suggestions.get(risk_type, f"建议关注 '{pattern}' 条款")


# ── Monthly Report Generator ──

class MonthlyReportGenerator:
    """月度资产负债平水报表生成器."""

    def generate(
        self,
        transactions: list[Transaction],
        assets: float = 0.0,
        liabilities: float = 0.0,
    ) -> dict[str, Any]:
        """生成月度报表."""
        total_income = sum(tx.amount for tx in transactions if tx.amount > 0)
        total_expense = sum(abs(tx.amount) for tx in transactions if tx.amount < 0)
        net_cash_flow = total_income - total_expense

        net_worth = assets - liabilities
        debt_ratio = liabilities / assets if assets > 0 else 0.0

        # 按类别汇总支出
        category_expense: dict[str, float] = {}
        for tx in transactions:
            if tx.amount < 0:
                cat = tx.category or "uncategorized"
                category_expense[cat] = category_expense.get(cat, 0) + abs(tx.amount)

        return {
            "period": datetime.now(UTC).strftime("%Y-%m"),
            "total_income": total_income,
            "total_expense": total_expense,
            "net_cash_flow": net_cash_flow,
            "assets": assets,
            "liabilities": liabilities,
            "net_worth": net_worth,
            "debt_ratio": debt_ratio,
            "category_expense": category_expense,
            "transaction_count": len(transactions),
        }


# ── Main Audit Engine ──

class AssetAuditEngine:
    """资产审计引擎 — 整合解析、检测、审查、报表功能."""

    def __init__(self):
        self.parser = BankStatementParser()
        self.detector = LargeExpenseDetector()
        self.reviewer = ContractReviewer()
        self.report_gen = MonthlyReportGenerator()

    def audit_monthly(
        self,
        statement_content: str,
        assets: float = 0.0,
        liabilities: float = 0.0,
        statement_format: str = "csv",
    ) -> dict[str, Any]:
        """执行月度审计."""
        # 1. 解析流水
        transactions = self.parser.parse(statement_content, statement_format)

        # 2. 检测大额支出
        alerts = self.detector.detect(transactions)

        # 3. 生成报表
        report = self.report_gen.generate(transactions, assets, liabilities)

        return {
            "report": report,
            "alerts": [
                {
                    "level": a.level,
                    "type": a.type,
                    "message": a.message,
                    "details": a.details,
                }
                for a in alerts
            ],
            "transaction_count": len(transactions),
        }

    def review_contract(self, contract_text: str) -> list[dict[str, Any]]:
        """审查合同."""
        risks = self.reviewer.review(contract_text)
        return [
            {
                "clause": r.clause,
                "risk_type": r.risk_type,
                "severity": r.severity,
                "suggestion": r.suggestion,
            }
            for r in risks
        ]
