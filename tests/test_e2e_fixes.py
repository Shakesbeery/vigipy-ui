"""Verification test script for vigipy-ui fixes."""

import json
import time
import urllib.request

BASE = "http://127.0.0.1:8765"


def post(path, data):
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def get(path):
    with urllib.request.urlopen(f"{BASE}{path}") as resp:
        return json.loads(resp.read().decode())


def run_tests():
    print("=== 1. Testing Ingestion ===")
    ingest_resp = post(
        "/api/data/ingest",
        {
            "file_path": "G:/My Drive/GitStuff/vigipy/examples/DYB.csv",
            "product_col": "BRAND_NAME",
            "ae_col": "Event",
            "count_col": "count",
            "auto_populate_count": False,
            "default_count": 1,
            "date_col": "DATE_REPORT",
        },
    )
    print(
        f"Ingested summary: {ingest_resp['total_raw_rows']:,} rows, {ingest_resp['unique_pairs']:,} pairs"
    )

    h = get("/api/health")
    print("Health after ingest (has_results):", h["has_results"])
    assert h["has_results"] is False, "Analysis should NOT run automatically!"
    print("PASS: Analysis was NOT run automatically on ingestion.")

    print("\n=== 2. Testing Manual Analysis Run ===")
    run_resp = post(
        "/api/analysis/run",
        {
            "consensus": True,
            "prr": {
                "enabled": True,
                "relative_risk": 1.0,
                "min_events": 3,
                "decision_metric": "fdr",
                "decision_thres": 0.05,
                "ranking_statistic": "p_value",
                "expected_method": "mantel-haentzel",
                "method_alpha": 1.0,
                "fdr_threshold": 0.05,
                "continuity_correction": True,
            },
            "ror": {
                "enabled": True,
                "relative_risk": 1.0,
                "min_events": 3,
                "decision_metric": "fdr",
                "decision_thres": 0.05,
                "ranking_statistic": "p_value",
                "expected_method": "mantel-haentzel",
                "method_alpha": 1.0,
                "fdr_threshold": 0.05,
                "continuity_correction": True,
            },
            "bcpnn": {
                "enabled": True,
                "relative_risk": 1.0,
                "min_events": 3,
                "decision_metric": "rank",
                "decision_thres": 0.0,
                "ranking_statistic": "quantile",
                "MC": False,
                "num_MC": 1000,
                "expected_method": "mantel-haentzel",
                "method_alpha": 1.0,
            },
        },
    )
    print("Job started:", run_resp["job_id"])

    status = None
    for _ in range(60):
        status = get("/api/analysis/status")
        if status["status"] in ("completed", "failed"):
            break
        print(f"Progress: {status['progress']:.0%} - {status['step']}")
        time.sleep(1)

    print(f"Final status: {status['status']} - {status.get('step')}")
    assert status["status"] == "completed", f"Analysis failed: {status.get('error')}"

    print("\n=== 3. Testing Query Signals ===")
    query_resp = post("/api/signals/query", {"limit": 3, "offset": 0})
    rows = query_resp["rows"]
    print(f"Total: {query_resp['total_records']}, Filtered: {query_resp['filtered_records']}")
    for i, r in enumerate(rows):
        print(
            f"Row {i}: {r['product']} -> {r['adverse_event']} | Count: {r['count']} | Consensus Score: {r['consensus_score']}"
        )

    print("\n=== 4. Testing Inspect Endpoint on Distinct Rows ===")
    insp0 = post(
        "/api/signals/inspect",
        {"product": rows[0]["product"], "adverse_event": rows[0]["adverse_event"]},
    )
    insp1 = post(
        "/api/signals/inspect",
        {"product": rows[1]["product"], "adverse_event": rows[1]["adverse_event"]},
    )

    print(f"Inspect Row 0: {insp0['product']} | {insp0['adverse_event']}")
    print(f"  Count: {insp0['count']}, Expected: {insp0['expected_count']}")
    for m in insp0["methods"]:
        print(
            f"  Method {m['method']}: Score={m['score']}, 95% CI=[{m['ci_lower']}, {m['ci_upper']}], Alert={m['alert']}"
        )

    print(f"\nInspect Row 1: {insp1['product']} | {insp1['adverse_event']}")
    print(f"  Count: {insp1['count']}, Expected: {insp1['expected_count']}")
    for m in insp1["methods"]:
        print(
            f"  Method {m['method']}: Score={m['score']}, 95% CI=[{m['ci_lower']}, {m['ci_upper']}], Alert={m['alert']}"
        )

    assert insp0["count"] != insp1["count"], "Row 0 and Row 1 must have different counts!"
    assert insp0["product"] != insp1["product"], "Products should differ!"
    assert (
        insp0["methods"][0]["score"] != insp1["methods"][0]["score"]
    ), "Method scores must be distinct!"
    print("PASS: Inspect endpoint returns distinct, accurate row data for each signal!")

    print("\n=== 5. Testing Concordance Matrix ===")
    conc = get("/api/consensus/concordance")
    print("Concordance methods:", conc["methods"])
    print("Jaccard matrix keys:", list(conc["jaccard"].keys()))
    print("PASS: Concordance matrix returned successfully!")

    print("\nALL VERIFICATION CHECKS PASSED!")


if __name__ == "__main__":
    run_tests()
