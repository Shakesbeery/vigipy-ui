"""End-to-end verification script for per-method thresholds and longitudinal candidate fixes."""

import requests
import pandas as pd
import tempfile
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8765"

def run_test():
    print("=== Testing /api/health ===")
    r = requests.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200, f"Health failed: {r.text}"
    print("Health OK.")

    # 1. Reset state
    r = requests.post(f"{BASE_URL}/api/data/reset")
    assert r.status_code == 200

    # 2. Create synthetic dataset with time slices
    dates = [
        "2022-01-15", "2022-02-10", "2022-03-05", "2022-04-12", "2022-05-20", "2022-06-15",
        "2023-01-15", "2023-02-10", "2023-03-05", "2023-04-12", "2023-05-20", "2023-06-15",
        "2024-01-15", "2024-02-10", "2024-03-05", "2024-04-12", "2024-05-20", "2024-06-15",
    ]
    records = []
    # Signal pair DrugA -> Nausea with high count over time
    for d in dates:
        records.append({"Drug": "DrugA", "Reaction": "Nausea", "Count": 15, "ReportDate": d})
        records.append({"Drug": "DrugA", "Reaction": "Headache", "Count": 2, "ReportDate": d})
        records.append({"Drug": "DrugB", "Reaction": "Nausea", "Count": 1, "ReportDate": d})
        records.append({"Drug": "DrugB", "Reaction": "Headache", "Count": 10, "ReportDate": d})
        records.append({"Drug": "DrugC", "Reaction": "Dizziness", "Count": 8, "ReportDate": d})
        records.append({"Drug": "DrugD", "Reaction": "Fatigue", "Count": 6, "ReportDate": d})

    df = pd.DataFrame(records)
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
        tmp_csv = f.name
        df.to_csv(tmp_csv, index=False)

    print(f"Created synthetic dataset with {len(df)} rows at {tmp_csv}")

    # 3. Ingest
    ingest_payload = {
        "file_path": tmp_csv,
        "product_col": "Drug",
        "ae_col": "Reaction",
        "count_col": "Count",
        "date_col": "ReportDate",
        "auto_populate_count": False,
        "default_count": 1,
    }
    r = requests.post(f"{BASE_URL}/api/data/ingest", json=ingest_payload)
    assert r.status_code == 200, f"Ingest failed: {r.text}"
    print("Ingestion OK:", r.json())

    # 4. Check longitudinal signals BEFORE running longitudinal: MUST BE 0!
    r = requests.get(f"{BASE_URL}/api/longitudinal/signals?method=bcpnn")
    assert r.status_code == 200, f"GET longitudinal signals failed: {r.text}"
    data = r.json()
    assert len(data["signals"]) == 0, f"Expected 0 longitudinal candidates before running, got {len(data['signals'])}"
    print("Verified 0 candidates before longitudinal model runs: PASS.")

    # 5. Run static analysis (PRR + BCPNN + GPS) to test Per-Method Thresholds
    analysis_payload = {
        "prr": {"enabled": True, "decision_metric": "fdr", "decision_thres": 0.05},
        "bcpnn": {"enabled": True, "decision_metric": "rank", "decision_thres": 0.0, "ranking_statistic": "quantile"},
        "gps": {"enabled": True, "decision_metric": "rank", "decision_thres": 0.05, "ranking_statistic": "log2"},
        "consensus": True,
    }
    r = requests.post(f"{BASE_URL}/api/analysis/run", json=analysis_payload)
    assert r.status_code == 200
    
    # Wait for completion
    import time
    for _ in range(30):
        st = requests.get(f"{BASE_URL}/api/analysis/status").json()
        if st["status"] == "completed":
            break
        time.sleep(0.5)
    assert st["status"] == "completed", f"Analysis did not complete: {st}"

    # 6. Inspect signal to verify per-method threshold strings
    r = requests.post(f"{BASE_URL}/api/signals/inspect", json={"product": "DrugA", "adverse_event": "Nausea"})
    assert r.status_code == 200, f"Inspect failed: {r.text}"
    inspect_data = r.json()
    print("Inspect Response for DrugA -> Nausea:")
    for m in inspect_data["methods"]:
        print(f"  Method: {m['method']:<8} Alert: {str(m['alert']):<5} Metric: {m['metric']:<10} Score: {m['score']!s:<6} Threshold: {m['threshold']!s:<18}")
        assert m["threshold"] is not None and len(m["threshold"]) > 0, f"Missing threshold on method {m['method']}"
    print("Per-Method Thresholds verified: PASS.")

    # 7. Run Longitudinal analysis for BCPNN
    long_payload = {
        "method": "bcpnn",
        "time_unit": "YE",
        "mode": "cumulative",
        "include_gaps": False,
        "min_events": 3,
    }
    r = requests.post(f"{BASE_URL}/api/longitudinal/run", json=long_payload)
    assert r.status_code == 200
    for _ in range(30):
        st = requests.get(f"{BASE_URL}/api/analysis/status").json()
        if st["status"] == "completed":
            break
        time.sleep(0.5)
    assert st["status"] == "completed", f"Longitudinal run did not complete: {st}"

    # 8. Query longitudinal signals for BCPNN
    r = requests.get(f"{BASE_URL}/api/longitudinal/signals?method=bcpnn")
    assert r.status_code == 200
    data = r.json()
    print(f"BCPNN Longitudinal Signals count: {len(data['signals'])}, computed methods: {data['computed_methods']}")
    assert len(data["signals"]) > 0, "Expected at least 1 collapsed signal for BCPNN"
    first_sig = data["signals"][0]
    print(f"  Top signal: {first_sig['product']} -> {first_sig['adverse_event']}, Peak Score: {first_sig['peak_score']}, First Onset: {first_sig['first_onset']}, Slices Alerted: {first_sig['slices_alerted']}/{first_sig['total_slices']}")
    assert first_sig["peak_score"] is not None

    # 9. Verify Trajectory for BCPNN
    traj_r = requests.post(f"{BASE_URL}/api/longitudinal/trajectory", json={"product": first_sig["product"], "adverse_event": first_sig["adverse_event"], "method": "bcpnn"})
    assert traj_r.status_code == 200
    traj_data = traj_r.json()
    assert traj_data["method"] == "BCPNN"
    assert len(traj_data["trajectory"]) > 0
    print("BCPNN trajectory returned successfully.")

    # 10. Crucial Check: Request Trajectory for GPS (which was NOT run in longitudinal)
    traj_gps = requests.post(f"{BASE_URL}/api/longitudinal/trajectory", json={"product": first_sig["product"], "adverse_event": first_sig["adverse_event"], "method": "gps"})
    assert traj_gps.status_code == 200
    gps_data = traj_gps.json()
    print(f"Uncomputed GPS method check: method={gps_data['method']}, points count={len(gps_data['trajectory'])}")
    assert len(gps_data["trajectory"]) == 0, f"Expected 0 points for uncomputed GPS method, got {len(gps_data['trajectory'])} (preventing stale fallback!)"
    print("Prevented stale method graph fallback: PASS.")

    # Clean up
    if os.path.exists(tmp_csv):
        os.remove(tmp_csv)

    print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_test()
