"""Resumable bulk downloader for FDA FAERS quarterly ASCII extracts (2012Q1 onward).

Usage:
    python -m backend.faers.downloader [--root D:\\FAERS_DATA] [--start 2012]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import zipfile
from typing import Dict

import requests
from bs4 import BeautifulSoup

from . import DEFAULT_ROOT

INDEX_URL = "https://fis.fda.gov/extensions/FPD-QDE-FAERS/FPD-QDE-FAERS.html"
HEADERS = {"User-Agent": "Mozilla/5.0 (vigipy-ui FAERS warehouse)"}


def list_quarters(start_year: int = 2012) -> Dict[str, str]:
    """Scrape the FDA index page and return {'2012Q1': url, ...} for ASCII zips."""
    r = requests.get(INDEX_URL, headers=HEADERS, timeout=60)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    out: Dict[str, str] = {}
    for a in soup.find_all("a"):
        href = a.get("href") or ""
        if "ascii" not in href.lower() or not href.lower().endswith(".zip"):
            continue
        m = re.search(r"(20\d\d)[qQ](\d)", href)
        if m and int(m.group(1)) >= start_year:
            out[f"{m.group(1)}Q{m.group(2)}"] = href
    return dict(sorted(out.items()))


def _status_path(root: str) -> str:
    return os.path.join(root, "download_status.json")


def write_status(root: str, status: dict) -> None:
    tmp = _status_path(root) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(status, f, indent=2)
    os.replace(tmp, _status_path(root))


def read_status(root: str = DEFAULT_ROOT) -> dict:
    try:
        with open(_status_path(root), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _valid_zip(path: str) -> bool:
    try:
        with zipfile.ZipFile(path) as z:
            return any(n.lower().endswith(".txt") for n in z.namelist())
    except Exception:
        return False


def download_quarter(url: str, dest: str, retries: int = 10) -> None:
    """Stream a zip to disk with retry + HTTP Range resume."""
    part = dest + ".part"
    for attempt in range(1, retries + 1):
        try:
            have = os.path.getsize(part) if os.path.exists(part) else 0
            hdrs = dict(HEADERS)
            if have:
                hdrs["Range"] = f"bytes={have}-"
            with requests.get(url, headers=hdrs, stream=True, timeout=(30, 60)) as r:
                if r.status_code == 200 and have:
                    have = 0  # server ignored Range: restart
                r.raise_for_status()
                with open(part, "ab" if have else "wb") as f:
                    for chunk in r.iter_content(chunk_size=4 * 1024 * 1024):
                        if chunk:
                            f.write(chunk)
            if _valid_zip(part):
                os.replace(part, dest)
                return
            os.remove(part)
            raise IOError("Downloaded archive failed zip validation")
        except Exception as exc:
            print(f"    attempt {attempt}/{retries} failed: {exc}", flush=True)
            if attempt % 2 == 0 and os.path.exists(part):
                os.remove(part)  # resume keeps failing: restart from byte 0
            time.sleep(min(60, 10 * attempt))
    raise RuntimeError(f"Failed to download {url}")


def download_all(root: str = DEFAULT_ROOT, start_year: int = 2012, workers: int = 4) -> dict:
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import threading

    raw_dir = os.path.join(root, "raw")
    os.makedirs(raw_dir, exist_ok=True)
    quarters = list_quarters(start_year)
    status = {"state": "downloading", "total": len(quarters), "done": [], "failed": [], "current": []}
    lock = threading.Lock()
    todo = {}
    for q, url in quarters.items():
        dest = os.path.join(raw_dir, f"faers_ascii_{q}.zip")
        if os.path.exists(dest) and _valid_zip(dest):
            status["done"].append(q)
        else:
            todo[q] = (url, dest)
    write_status(root, status)

    def _job(q: str) -> str:
        url, dest = todo[q]
        with lock:
            status["current"].append(q)
            write_status(root, status)
        print(f"start {q} <- {url}", flush=True)
        download_quarter(url, dest)
        return q

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(_job, q): q for q in todo}
        for fut in as_completed(futs):
            q = futs[fut]
            with lock:
                if q in status["current"]:
                    status["current"].remove(q)
                try:
                    fut.result()
                    status["done"].append(q)
                    print(f"done {q} ({len(status['done'])}/{len(quarters)})", flush=True)
                except Exception as exc:
                    status["failed"].append(q)
                    print(f"  !! {q} failed: {exc}", flush=True)
                write_status(root, status)
    status["done"].sort()
    status["state"] = "downloaded" if not status["failed"] else "downloaded_with_errors"
    status["current"] = []
    write_status(root, status)
    return status


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=DEFAULT_ROOT)
    ap.add_argument("--start", type=int, default=2012)
    a = ap.parse_args()
    s = download_all(a.root, a.start)
    print(f"Finished: {len(s['done'])} ok, {len(s['failed'])} failed {s['failed']}")
