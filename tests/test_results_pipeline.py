import os
import sys
import tempfile
import pandas as pd
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.engine import import_results_file
from backend.app.main import query_signals
from backend.app.schemas import SignalQueryRequest


def test_import_results_standard_and_string_booleans():
    df = pd.DataFrame({
        "name": ["DrugA", "DrugB", "DrugC"],
        "AE": ["Nausea", "Headache", "Rash"],
        "n_cases": [25, 4, 18],
        "expected_count": [6.2, 5.0, 4.1],
        "score_prr": [4.03, 0.8, 4.39],
        "alert_prr": ["True", "False", "True"],
        "score_ror": [4.2, 0.82, 4.5],
        "alert_ror": ["1", "0", "1"],
        "score_aegis": [0.89, 0.12, 0.94],
        "alert_aegis": [True, False, True],
    })

    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w", newline="") as tmp:
        df.to_csv(tmp.name, index=False)
        tmp_path = tmp.name

    try:
        res = import_results_file(tmp_path)
        assert res["total_raw_rows"] == 3
        assert res["unique_products"] == 3
        assert res["unique_aes"] == 3
        assert res["total_signals"] == 2
        assert set(res["methods"]) == {"AEGIS", "PRR", "ROR"}

        # Query signals from AppState
        page = query_signals(SignalQueryRequest(offset=0, limit=10))
        assert page.total_records == 3
        assert set(page.methods) == {"AEGIS", "PRR", "ROR"}

        rows_by_prod = {r.product: r for r in page.rows}
        # DrugA: 3 votes (Unanimous)
        assert rows_by_prod["DrugA"].votes == 3
        assert rows_by_prod["DrugA"].consensus_score == 1.0
        assert rows_by_prod["DrugA"].agreement_tier == "Unanimous"
        assert rows_by_prod["DrugA"].method_alerts["prr"] is True

        # DrugB: 0 votes (None)
        assert rows_by_prod["DrugB"].votes == 0
        assert rows_by_prod["DrugB"].consensus_score == 0.0
        assert rows_by_prod["DrugB"].agreement_tier == "None"
        assert rows_by_prod["DrugB"].method_alerts["prr"] is False
        assert rows_by_prod["DrugB"].method_alerts["ror"] is False

        # DrugC: 3 votes (Unanimous)
        assert rows_by_prod["DrugC"].votes == 3
        assert rows_by_prod["DrugC"].consensus_score == 1.0
        assert rows_by_prod["DrugC"].agreement_tier == "Unanimous"
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def test_import_results_legacy_aliases():
    df = pd.DataFrame({
        "Product": ["Statin", "ACE_Inhibitor"],
        "Adverse Event": ["Myopathy", "Angioedema"],
        "Count": [50, 12],
        "expected": [10.0, 2.0],
        "score": [5.0, 6.0],
        "votes": [2, 2],
        "tier": ["Substantial", "Substantial"],
        "score_gps": [2.5, 3.1],
        "alert_gps": [True, True],
        "score_bcpnn": [1.8, 2.2],
        "alert_bcpnn": [True, True],
    })

    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w", newline="") as tmp:
        df.to_csv(tmp.name, index=False)
        tmp_path = tmp.name

    try:
        res = import_results_file(tmp_path)
        assert res["total_raw_rows"] == 2
        assert res["total_signals"] == 2
        assert set(res["methods"]) == {"BCPNN", "GPS"}
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def test_import_results_invalid_columns():
    df = pd.DataFrame({
        "col_x": [1, 2, 3],
        "col_y": ["a", "b", "c"],
    })

    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w", newline="") as tmp:
        df.to_csv(tmp.name, index=False)
        tmp_path = tmp.name

    try:
        with pytest.raises(ValueError) as excinfo:
            import_results_file(tmp_path)
        assert "does not contain identifiable 'Product' and 'Adverse Event' columns" in str(excinfo.value)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


if __name__ == "__main__":
    test_import_results_standard_and_string_booleans()
    test_import_results_legacy_aliases()
    test_import_results_invalid_columns()
    print("All results pipeline tests passed successfully!")
