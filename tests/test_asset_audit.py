"""test_asset_audit — BET-Y2Q3-T7-01 资产审计引擎单元测试.

覆盖:
  - BankStatementParser CSV 解析
  - LargeExpenseDetector 异常检测
  - ContractReviewer 风险审查
  - MonthlyReportGenerator 报表生成
  - AssetAuditEngine 整合流程
"""

from __future__ import annotations

import pytest

from family_hub.runtime.asset_audit import (
    AssetAuditEngine,
    BankStatementParser,
    ContractReviewer,
    LargeExpenseDetector,
    MonthlyReportGenerator,
    Transaction,
)


# ── Fixtures ──

SAMPLE_CSV = """date,amount,category,description
2026-09-01,5000.00,salary,月薪
2026-09-02,-150.00,food,超市购物
2026-09-03,-2000.00,rent,房租
2026-09-05,-50.00,transport,地铁充值
2026-09-07,-5000.00,transfer,大额转账测试
2026-09-10,-300.00,food,餐厅
"""

SAMPLE_CONTRACT = """本合同为服务协议。
第一条 甲方有权单方面修改条款。
第二条 最终解释权归甲方所有。
第三条 违约金为合同金额的 50%。
第四条 甲方概不负责任何损失赔偿。
第五条 甲方有权随时调整服务价格。
"""


# ── Tests: BankStatementParser ──

class TestBankStatementParser:
    def test_parse_csv_basic(self):
        parser = BankStatementParser()
        txs = parser.parse(SAMPLE_CSV, "csv")
        assert len(txs) == 6

    def test_parse_csv_amounts(self):
        parser = BankStatementParser()
        txs = parser.parse(SAMPLE_CSV, "csv")
        assert txs[0].amount == 5000.00  # income
        assert txs[1].amount == -150.00  # expense

    def test_parse_csv_categories(self):
        parser = BankStatementParser()
        txs = parser.parse(SAMPLE_CSV, "csv")
        assert txs[0].category == "salary"
        assert txs[2].category == "rent"

    def test_parse_empty_csv(self):
        parser = BankStatementParser()
        txs = parser.parse("date,amount,category,description\n", "csv")
        assert len(txs) == 0

    def test_parse_unsupported_format(self):
        parser = BankStatementParser()
        with pytest.raises(ValueError, match="不支持的格式"):
            parser.parse("content", "xml")

    def test_parse_ofx_placeholder(self):
        parser = BankStatementParser()
        txs = parser.parse("<OFX></OFX>", "ofx")
        assert txs == []

    def test_parse_pdf_placeholder(self):
        parser = BankStatementParser()
        txs = parser.parse("%PDF-1.4", "pdf")
        assert txs == []


# ── Tests: LargeExpenseDetector ──

class TestLargeExpenseDetector:
    def test_detect_large_expense(self):
        detector = LargeExpenseDetector(sigma_threshold=1.5)
        txs = [
            Transaction("2026-09-01", -50, "food", "午餐"),
            Transaction("2026-09-02", -55, "food", "晚餐"),
            Transaction("2026-09-03", -48, "transport", "打车"),
            Transaction("2026-09-04", -52, "food", "早餐"),
            Transaction("2026-09-05", -50, "food", "零食"),
            Transaction("2026-09-06", -45, "transport", "地铁"),
            Transaction("2026-09-07", -5000, "transfer", "大额"),
        ]
        alerts = detector.detect(txs)
        assert len(alerts) >= 1
        assert any("大额" in a.message for a in alerts)

    def test_detect_no_large_expense(self):
        detector = LargeExpenseDetector()
        txs = [
            Transaction("2026-09-01", -100, "food", "午餐"),
            Transaction("2026-09-02", -150, "food", "晚餐"),
            Transaction("2026-09-03", -80, "transport", "打车"),
        ]
        alerts = detector.detect(txs)
        assert len(alerts) == 0

    def test_detect_empty_list(self):
        detector = LargeExpenseDetector()
        alerts = detector.detect([])
        assert alerts == []

    def test_detect_fixed_threshold(self):
        detector = LargeExpenseDetector(fixed_threshold=1000)
        txs = [
            Transaction("2026-09-01", -100, "food", "午餐"),
            Transaction("2026-09-02", -1500, "shopping", "购物"),
        ]
        alerts = detector.detect(txs)
        assert len(alerts) == 1
        assert alerts[0].details["amount"] == 1500

    def test_detect_only_income(self):
        detector = LargeExpenseDetector()
        txs = [
            Transaction("2026-09-01", 5000, "salary", "月薪"),
        ]
        alerts = detector.detect(txs)
        assert alerts == []


# ── Tests: ContractReviewer ──

class TestContractReviewer:
    def test_review_detects_unfair_clauses(self):
        reviewer = ContractReviewer()
        risks = reviewer.review(SAMPLE_CONTRACT)
        assert len(risks) > 0
        risk_types = [r.risk_type for r in risks]
        assert "unfair" in risk_types

    def test_review_detects_vague_clauses(self):
        reviewer = ContractReviewer()
        text = "本合同有效期为合理期限，重大损失由双方协商。"
        risks = reviewer.review(text)
        risk_types = [r.risk_type for r in risks]
        assert "vague" in risk_types

    def test_review_severity_range(self):
        reviewer = ContractReviewer()
        risks = reviewer.review(SAMPLE_CONTRACT)
        for r in risks:
            assert 0 <= r.severity <= 1

    def test_review_clean_contract(self):
        reviewer = ContractReviewer()
        text = "本合同为普通服务协议。双方权利义务对等。"
        risks = reviewer.review(text)
        assert len(risks) == 0

    def test_review_has_suggestion(self):
        reviewer = ContractReviewer()
        risks = reviewer.review(SAMPLE_CONTRACT)
        for r in risks:
            assert len(r.suggestion) > 0


# ── Tests: MonthlyReportGenerator ──

class TestMonthlyReportGenerator:
    def test_generate_basic_report(self):
        gen = MonthlyReportGenerator()
        txs = [
            Transaction("2026-09-01", 5000, "salary", "月薪"),
            Transaction("2026-09-02", -2000, "rent", "房租"),
            Transaction("2026-09-03", -500, "food", "购物"),
        ]
        report = gen.generate(txs, assets=100000, liabilities=20000)

        assert report["total_income"] == 5000
        assert report["total_expense"] == 2500
        assert report["net_cash_flow"] == 2500
        assert report["net_worth"] == 80000
        assert report["debt_ratio"] == 0.2

    def test_generate_category_expense(self):
        gen = MonthlyReportGenerator()
        txs = [
            Transaction("2026-09-01", -100, "food", "午餐"),
            Transaction("2026-09-02", -200, "food", "晚餐"),
            Transaction("2026-09-03", -50, "transport", "地铁"),
        ]
        report = gen.generate(txs)
        assert report["category_expense"]["food"] == 300
        assert report["category_expense"]["transport"] == 50

    def test_generate_empty_transactions(self):
        gen = MonthlyReportGenerator()
        report = gen.generate([], assets=50000, liabilities=10000)
        assert report["total_income"] == 0
        assert report["total_expense"] == 0
        assert report["net_worth"] == 40000


# ── Tests: AssetAuditEngine ──

class TestAssetAuditEngine:
    def test_audit_monthly(self):
        engine = AssetAuditEngine()
        result = engine.audit_monthly(SAMPLE_CSV, assets=100000, liabilities=20000)

        assert "report" in result
        assert "alerts" in result
        assert result["transaction_count"] == 6

    def test_audit_monthly_with_large_expense(self):
        engine = AssetAuditEngine()
        # 使用固定阈值确保检测到大额支出
        engine.detector = LargeExpenseDetector(fixed_threshold=1000)
        result = engine.audit_monthly(SAMPLE_CSV, assets=100000, liabilities=20000)
        # 5000 大额转账和 2000 房租都应该被检测到 (>= 1000)
        assert len(result["alerts"]) >= 1

    def test_review_contract(self):
        engine = AssetAuditEngine()
        risks = engine.review_contract(SAMPLE_CONTRACT)
        assert len(risks) > 0
        assert any(r["risk_type"] == "unfair" for r in risks)

    def test_review_clean_contract(self):
        engine = AssetAuditEngine()
        risks = engine.review_contract("普通合同文本")
        assert len(risks) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-q"])
