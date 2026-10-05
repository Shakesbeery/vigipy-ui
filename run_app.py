"""vigipy-ui Application Launcher.

Starts the computational backend engine and launches the UI in standalone desktop app window mode
or in your default browser. Zero setup required.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
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

    # Check if backend is already running
    if is_backend_healthy():
        print(f"[*] vigipy backend already running at {APP_URL}")
    else:
        print("[*] Starting vigipy computational backend daemon...")
        python_exe = sys.executable
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
        
        # Start server as a background subprocess
        proc = subprocess.Popen(
            backend_cmd,
            cwd=os.path.dirname(os.path.abspath(__file__)),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        # Wait for health check
        print("[*] Waiting for engine startup...", end="", flush=True)
        retries = 30
        while retries > 0:
            if is_backend_healthy():
                print(" Ready!")
                break
            time.sleep(0.5)
            print(".", end="", flush=True)
            retries -= 1

        if retries == 0:
            print("\n[!] Error: Backend failed to respond within 15 seconds.")
            sys.exit(1)

    print(f"[*] Launching user interface at {APP_URL}")
    launch_desktop_window(APP_URL)
    print("[*] vigipy-ui is running. Press CTRL+C to close.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] Exiting vigipy-ui. Goodbye!")


if __name__ == "__main__":
    main()
