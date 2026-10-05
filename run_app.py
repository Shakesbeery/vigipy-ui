"""vigipy-ui Application Launcher.

Starts the computational backend engine and launches the UI in standalone desktop app window mode
or in your default browser. Zero setup required.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import webbrowser

BACKEND_HOST = "127.0.0.1"
BACKEND_PORT = 8765
APP_URL = f"http://{BACKEND_HOST}:{BACKEND_PORT}"


def is_backend_healthy() -> bool:
    """Check if the FastAPI backend is running and responding."""
    try:
        req = urllib.request.Request(f"{APP_URL}/api/health", headers={"User-Agent": "vigipy-launcher"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            return resp.status == 200
    except Exception:
        return False


def is_valid_interpreter(py_exe: str) -> bool:
    """Check if a given Python interpreter has vigipy, uvicorn, and fastapi installed."""
    if not py_exe or not os.path.isfile(py_exe):
        return False
    try:
        res = subprocess.run(
            [py_exe, "-c", "import vigipy, uvicorn, fastapi; print('OK')"],
            capture_output=True,
            text=True,
            timeout=8,
        )
        return res.returncode == 0 and "OK" in res.stdout
    except Exception:
        return False


def find_viable_python() -> str:
    """Find a functional Python interpreter with vigipy and FastAPI backend modules."""
    # 1. Check current sys.executable
    if is_valid_interpreter(sys.executable):
        return sys.executable

    # 2. Check active conda environment
    conda_prefix = os.environ.get("CONDA_PREFIX")
    if conda_prefix:
        cand = os.path.join(conda_prefix, "python.exe" if sys.platform == "win32" else "bin/python")
        if is_valid_interpreter(cand):
            return cand

    # 3. Check known conda / virtual environment locations
    candidates = [
        os.path.expandvars(r"%USERPROFILE%\anaconda3\envs\vigipy\python.exe"),
        r"C:\Users\shake\anaconda3\envs\vigipy\python.exe",
        os.path.expandvars(r"%USERPROFILE%\miniconda3\envs\vigipy\python.exe"),
        os.path.expandvars(r"%USERPROFILE%\.conda\envs\vigipy\python.exe"),
        os.path.expandvars(r"C:\ProgramData\anaconda3\envs\vigipy\python.exe"),
    ]

    for cand in candidates:
        if cand and os.path.isfile(cand) and is_valid_interpreter(cand):
            return cand

    # 4. Check registered environments in conda environments.txt
    env_txt = os.path.expandvars(r"%USERPROFILE%\.conda\environments.txt")
    if os.path.isfile(env_txt):
        try:
            with open(env_txt, "r", encoding="utf-8") as f:
                for line in f:
                    env_dir = line.strip()
                    if env_dir:
                        cand = os.path.join(env_dir, "python.exe" if sys.platform == "win32" else "bin/python")
                        if is_valid_interpreter(cand):
                            return cand
        except Exception:
            pass

    return sys.executable


def launch_desktop_window(url: str) -> None:
    """Launch the application as a standalone desktop window on Windows/macOS/Linux."""
    # 1. On Windows, check for Microsoft Edge app mode (frameless native desktop window)
    if sys.platform == "win32":
        edge_paths = [
            os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
            os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
            shutil.which("msedge"),
        ]
        for ep in edge_paths:
            if ep and os.path.exists(ep):
                try:
                    subprocess.Popen([ep, f"--app={url}", "--window-size=1400,900"])
                    return
                except Exception:
                    pass

    # 2. Check for Chrome app mode
    chrome_paths = [
        shutil.which("google-chrome"),
        shutil.which("chrome"),
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
    ]
    for cp in chrome_paths:
        if cp and os.path.exists(cp):
            try:
                subprocess.Popen([cp, f"--app={url}", "--window-size=1400,900"])
                return
            except Exception:
                pass

    # 3. Fallback to default system browser
    webbrowser.open(url)


def main() -> None:
    print("=" * 70)
    print("  vigipy-ui — Pharmacovigilance & Disproportionality Signal Detection")
    print("=" * 70)

    repo_dir = os.path.dirname(os.path.abspath(__file__))
    proc = None

    # Check if backend is already running
    if is_backend_healthy():
        print(f"[*] vigipy backend is already running at {APP_URL}")
    else:
        python_exe = find_viable_python()
        print(f"[*] Using Python runtime: {python_exe}")

        backend_cmd = [
            python_exe,
            "-m",
            "uvicorn",
            "backend.app.main:app",
            "--host",
            BACKEND_HOST,
            "--port",
            str(BACKEND_PORT),
        ]

        log_dir = os.path.join(tempfile.gettempdir(), "vigipy")
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, "backend_startup.log")
        log_f = open(log_file, "w", encoding="utf-8")

        print("[*] Starting vigipy computational backend daemon...")
        proc = subprocess.Popen(
            backend_cmd,
            cwd=repo_dir,
            stdout=log_f,
            stderr=subprocess.STDOUT,
        )

        # Wait for health check with clear progress and premature exit detection
        print("[*] Waiting for engine startup...", end="", flush=True)
        retries = 60
        started = False
        while retries > 0:
            if is_backend_healthy():
                started = True
                print(" Ready!", flush=True)
                break

            poll_code = proc.poll()
            if poll_code is not None:
                print(f"\n[!] Backend process exited prematurely with code {poll_code}.", flush=True)
                break

            time.sleep(0.5)
            print(".", end="", flush=True)
            retries -= 1

        if not started:
            log_f.flush()
            log_f.close()
            print("\n[!] Error: Backend failed to respond within startup timeout.", flush=True)
            if os.path.isfile(log_file):
                print("-" * 60, flush=True)
                print(f"Engine Log ({log_file}):", flush=True)
                try:
                    with open(log_file, "r", encoding="utf-8", errors="ignore") as lf:
                        lines = lf.readlines()
                        print("".join(lines[-25:]), flush=True)
                except Exception:
                    pass
                print("-" * 60, flush=True)
            sys.exit(1)

    print(f"[*] Launching user interface at {APP_URL}", flush=True)
    launch_desktop_window(APP_URL)
    print("[*] vigipy-ui is running. Press CTRL+C to close.", flush=True)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] Exiting vigipy-ui. Shutting down engine...")
        if proc:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except Exception:
                proc.kill()
        print("[*] Goodbye!")


if __name__ == "__main__":
    main()
