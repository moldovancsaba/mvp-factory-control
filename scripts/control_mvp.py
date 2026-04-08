"""
macOS Control.app (rumps): menu-bar supervisor for Colima/Docker, env-variables server, settings panel,
https gateway, MVP Factory Control Next app, and related LaunchAgent wiring.

Paths derive from REPO_ROOT (parent of scripts/). Mutates PATH and forces DOCKER_HOST/DOCKER_CONTEXT for Colima.
See docs/INTERNAL_CONTROL_APP.md and scripts/bootstrap.sh for operator-facing setup.
"""
import rumps
import subprocess
import os
import signal
import socket
import shutil
import time
import datetime
import webbrowser
import sys
import json

# Fix PATH for LaunchAgent execution
local_bin = os.path.expanduser("~/.local/bin")
os.environ["PATH"] = (
    f"{local_bin}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:{os.environ.get('PATH', '')}"
)

# Hardcode Docker Environment for Colima
os.environ["DOCKER_HOST"] = (
    f"unix://{os.path.expanduser('~')}/.colima/default/docker.sock"
)
os.environ["DOCKER_CONTEXT"] = "colima"

# Log Environment for verification
print(f"--- Control Started at {datetime.datetime.now()} ---")
print(f"DOCKER_HOST: {os.environ['DOCKER_HOST']}")
print(f"DOCKER_CONTEXT: {os.environ['DOCKER_CONTEXT']}")
print(f"USER: {os.environ.get('USER')}")
print(f"HOME: {os.environ.get('HOME')}")
print("------------------------------------------")

# Configuration
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOME = os.path.expanduser("~")
ENV_VARIABLES_PORT = 3199
ENV_SERVER_DIR = os.path.join(REPO_ROOT, "scripts", "env-variables")
ENV_SERVER_PY = os.path.join(ENV_SERVER_DIR, "server.py")
SETTINGS_PANEL_PORT = 3200
SETTINGS_PANEL_DIR = os.path.join(REPO_ROOT, "scripts", "settings-panel")
SETTINGS_PANEL_PY = os.path.join(SETTINGS_PANEL_DIR, "server.py")
HTTPS_GATEWAY_PORT = int(os.environ.get("MVP_HTTPS_GATEWAY_PORT", "3443"))
os.environ["MVP_HTTPS_GATEWAY_PORT"] = str(HTTPS_GATEWAY_PORT)
HTTPS_GATEWAY_DIR = os.path.join(REPO_ROOT, "scripts", "https-gateway")
HTTPS_GATEWAY_PY = os.path.join(HTTPS_GATEWAY_DIR, "server.py")
# Browser URL for Paperclip: SPA uses root-relative /api/* — only works at origin / (not under /dashboard/).
DASHBOARD_BROWSER_URL = (
    os.environ.get("MVP_FACTORY_CONTROL_DASHBOARD_BROWSER_URL", "http://127.0.0.1:3100/").strip()
    or "http://127.0.0.1:3100/"
)
RUNTIME_STATE_DIR = os.path.join(REPO_ROOT, ".mvp-factory-control")
APP_SETTINGS_PATH = os.path.join(RUNTIME_STATE_DIR, "settings.json")
CONTROL_PANEL_SETTINGS_PATH = os.path.join(RUNTIME_STATE_DIR, "control-panel-settings.json")
TLS_DIR = os.path.join(RUNTIME_STATE_DIR, "tls")
TLS_CERT_PATH = os.path.join(TLS_DIR, "localhost-cert.pem")
PYTHON_CMD = sys.executable


def load_json_file(path, default):
    if not os.path.isfile(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Failed to load json file {path}: {exc}")
        return default


def load_control_panel_settings():
    sibling_root = os.path.dirname(REPO_ROOT)
    defaults = {
        "sharedRoot": os.environ.get("MVP_FACTORY_SHARED_ROOT", sibling_root),
        "paperclipRoot": os.path.join(sibling_root, "paperclip"),
        "checklistRoot": os.path.join(sibling_root, "checklist"),
        "checklistEnvPath": os.path.join(sibling_root, "checklist", ".env"),
    }
    stored = load_json_file(CONTROL_PANEL_SETTINGS_PATH, {})
    if not isinstance(stored, dict):
        return defaults
    merged = defaults.copy()
    for key in defaults:
        value = stored.get(key)
        if isinstance(value, str) and value.strip():
            merged[key] = os.path.abspath(os.path.expanduser(value.strip()))
    return merged


CONTROL_PANEL_SETTINGS = load_control_panel_settings()
os.environ.setdefault("MVP_FACTORY_SHARED_ROOT", CONTROL_PANEL_SETTINGS["sharedRoot"])
os.environ.setdefault("CHECKLIST_ENV_PATH", CONTROL_PANEL_SETTINGS["checklistEnvPath"])
PAPERCLIP_ROOT = CONTROL_PANEL_SETTINGS["paperclipRoot"]


def resolve_opencode_command():
    candidates = [
        os.path.expanduser("~/.local/bin/opencode"),
        "/opt/homebrew/bin/opencode",
        shutil.which("opencode"),
    ]
    for candidate in candidates:
        if candidate and os.path.isfile(candidate):
            return candidate
    return "/opt/homebrew/bin/opencode"


def build_checklist_env_candidates():
    candidates = []
    explicit = os.environ.get("CHECKLIST_ENV_PATH")
    if explicit:
        candidates.append(explicit)

    configured_root = CONTROL_PANEL_SETTINGS.get("checklistRoot")
    if configured_root:
        candidates.append(os.path.join(configured_root, ".env"))

    shared_root = os.environ.get("MVP_FACTORY_SHARED_ROOT")
    if shared_root:
        candidates.append(os.path.join(shared_root, "checklist", ".env"))
        candidates.append(os.path.join(shared_root, "Projects", "checklist", ".env"))

    repo_parent = os.path.dirname(REPO_ROOT)
    candidates.append(os.path.join(repo_parent, "checklist", ".env"))

    if "/Users/Shared" in REPO_ROOT:
        shared_prefix = REPO_ROOT.split("/Users/Shared", 1)[0] + "/Users/Shared"
        candidates.append(os.path.join(shared_prefix, "checklist", ".env"))
        candidates.append(os.path.join(shared_prefix, "Projects", "checklist", ".env"))

    candidates.append("/Users/Shared/checklist/.env")
    candidates.append("/Users/Shared/Projects/checklist/.env")

    unique = []
    seen = set()
    for candidate in candidates:
        normalized = os.path.abspath(os.path.expanduser(candidate))
        if normalized not in seen:
            seen.add(normalized)
            unique.append(normalized)
    return unique


def load_dotenv(path):
    if not os.path.isfile(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                os.environ.setdefault(key, value)
    except OSError as exc:
        print(f"Failed to load env file {path}: {exc}")


for env_path in [os.path.join(REPO_ROOT, ".env"), *build_checklist_env_candidates()]:
    load_dotenv(env_path)

SERVICES = {
    "Paperclip": {
        "port": 3100,
        "cwd": PAPERCLIP_ROOT,
        "cmd": ["/opt/homebrew/bin/pnpm", "dev"],
    },
    "OpenCode": {
        "port": 18788,
        "cmd": [
            resolve_opencode_command(),
            "serve",
            "--hostname",
            "127.0.0.1",
            "--port",
            "18788",
        ],
    },
    "Ollama": {"port": 11434, "cmd": ["/opt/homebrew/bin/ollama", "serve"]},
    "ScrumMaster": {
        "port": 0,  # Daemon only
        "cwd": REPO_ROOT,
        "cmd": [
            PYTHON_CMD,
            os.path.join(REPO_ROOT, "scripts", "scrum_master_daemon.py"),
        ],
        "proc_pattern": "scripts/scrum_master_daemon.py",
        "env": {
            "SCRUM_MASTER_PAPERCLIP_HEALTH_URL": f"https://127.0.0.1:{HTTPS_GATEWAY_PORT}/dashboard/api/health",
            "LOCAL_TLS_CERT_PATH": TLS_CERT_PATH,
        },
    },
    "AgentConnector": {
        "port": 3198,
        "cwd": REPO_ROOT,
        "cmd": [
            PYTHON_CMD,
            os.path.join(REPO_ROOT, "scripts", "agent_connector_server.py"),
        ],
        "env": {
            "LOCAL_TLS_CERT_PATH": TLS_CERT_PATH,
        },
    },
    "ChecklistSync": {
        "port": 10005,
        "cwd": os.path.join(CONTROL_PANEL_SETTINGS["checklistRoot"], "scripts"),
        "cmd": ["/opt/homebrew/bin/node", "sync.js"],
        "env": {
            "PORT": "10005",
            "OLLAMA_MODEL": "gemma4:latest",
            "OLLAMA_HOST": "http://127.0.0.1:11434",
            "CHECKLIST_RESEARCH_ENABLED": "true",
            "CHECKLIST_RESEARCH_PROVIDER": "duckduckgo-html",
            "CHECKLIST_RESEARCH_REFRESH_HOURS": "24",
            "CHECKLIST_RESEARCH_MAX_QUERIES": "2",
            "CHECKLIST_RESEARCH_MAX_RESULTS": "3",
            "CHECKLIST_RESEARCH_MAX_FETCHES": "3",
            "CHECKLIST_FACTCHECK_MIN_CITATIONS": "2",
            "CHECKLIST_FACTCHECK_MIN_DOMAINS": "2",
            "NEON_DB": os.environ.get("NEON_DB", os.environ.get("DATABASE_URL", "")),
        },
        "auto_restart": True,
    },
}


class ControlApp(rumps.App):
    def __init__(self):
        super(ControlApp, self).__init__("Control", quit_button=None)
        self.restart_history = {}  # tracked by service name: {"last_attempt": timestamp, "count": int}
        self.status_header = rumps.MenuItem("Status: Initializing...")
        self.infra_item = rumps.MenuItem(
            "🐳 Docker Infrastructure: Checking...", callback=self.toggle_infrastructure
        )
        self.cli_status_item = rumps.MenuItem("🤖 Agent CLIs: Checking...")
        self.dashboard_link = rumps.MenuItem(
            "🌐 Open Dashboard (Paperclip)", callback=self.open_dashboard
        )
        self.docs_link = rumps.MenuItem(
            "📚 Open Documentation", callback=self.open_docs
        )
        self.variables_link = rumps.MenuItem(
            "🔑 Open Variables", callback=self.open_variables
        )
        self.settings_link = rumps.MenuItem(
            "⚙️ Open Settings", callback=self.open_settings
        )
        self.connector_link = rumps.MenuItem(
            "🤖 Open Agent Connectors", callback=self.open_connectors
        )
        self.update_link = rumps.MenuItem(
            "🔄 Check for Updates", callback=self.check_updates
        )
        self.menu = [
            self.status_header,
            self.infra_item,
            self.cli_status_item,
            None,
            self.dashboard_link,
            self.docs_link,
            self.variables_link,
            self.settings_link,
            self.connector_link,
            self.update_link,
            None,
        ]
        self.processes = {}

        self.menu_items = {}
        for name in SERVICES:
            initial_title = f"🔴 Start {name}"
            item = rumps.MenuItem(initial_title, callback=self.toggle_service)
            # Store the name and the current title for robust access
            self.menu_items[name] = {"item": item, "current_title": initial_title}
            self.menu.add(item)

        self.menu.add(None)  # Separator
        self.menu.add(rumps.MenuItem("Restart All", callback=self.restart_all))
        self.menu.add(None)  # Separator
        self.menu.add(rumps.MenuItem("v1.4.0-sovereign"))

        # Initial status check before starting timer
        self.check_status()

        # Timer for health checks (every 10 seconds)
        self.timer = rumps.Timer(self.check_status, 10)
        self.timer.start()

        # Keep the local HTTPS gateway available for browser entrypoints.
        self.ensure_https_gateway_server()

        # Auto-start core services on launch
        rumps.notification(
            "Factory Control",
            "Initializing Core...",
            "Automatic bootstrap of Ollama, Checklist worker, and core local services.",
        )
        self.start_service("Ollama")
        self.start_service("Paperclip")
        self.start_service("OpenCode")
        self.start_service("ScrumMaster")
        self.start_service("AgentConnector")
        self.start_service("ChecklistSync")

    def is_port_open(self, port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            return s.connect_ex(("127.0.0.1", port)) == 0

    def is_daemon_running(self):
        docker_host = f"unix://{os.path.expanduser('~')}/.colima/default/docker.sock"
        socket_path = docker_host.replace("unix://", "")
        return os.path.exists(socket_path)

    def is_docker_running(self, name):
        if not self.is_daemon_running():
            return False, "infrastructure_down"
        try:
            docker_host = (
                f"unix://{os.path.expanduser('~')}/.colima/default/docker.sock"
            )
            cmd = [
                "/opt/homebrew/bin/docker",
                "-H",
                docker_host,
                "inspect",
                "-f",
                "{{.State.Running}}",
                name,
            ]
            print(f"Running docker check: {' '.join(cmd)}")
            out = subprocess.check_output(cmd, env=os.environ, stderr=subprocess.STDOUT)
            is_up = out.decode().strip() == "true"
            return is_up, "ok"
        except Exception as e:
            print(f"Error checking docker status for {name}: {e}")
            return False, "error"

    def is_cli_available(self, cmd_name):
        try:
            extra_path = os.path.expanduser("~/.local/bin")
            env = os.environ.copy()
            if extra_path not in env.get("PATH", ""):
                env["PATH"] = f"{extra_path}:{env.get('PATH', '')}"
            import shutil

            return shutil.which(cmd_name, path=env["PATH"]) is not None
        except Exception:
            return False

    def is_process_running(self, pattern):
        try:
            # Check for the process using pgrep -f
            subprocess.check_output(["pgrep", "-f", pattern])
            return True
        except subprocess.CalledProcessError:
            return False
        except Exception:
            return False

    def check_status(self, _=None):
        statuses = []
        daemon_up = self.is_daemon_running()
        infra_emoji = "🟢" if daemon_up else "🔴"
        self.infra_item.title = f"🐳 Docker Infrastructure: {infra_emoji} {'Active' if daemon_up else 'Down'}"

        pi_ok = self.is_cli_available("pi")
        hermes_ok = self.is_cli_available("hermes")
        self.cli_status_item.title = f"🤖 Agent CLIs: {'🟢' if pi_ok else '🔴'} Pi | {'🟢' if hermes_ok else '🔴'} Hermes"

        for name, config in SERVICES.items():
            try:
                running = False
                infra_failure = False
                if config.get("is_docker"):
                    running, mode = self.is_docker_running(config["docker_name"])
                    if mode == "infrastructure_down":
                        infra_failure = True
                elif config.get("port") == 0 and "proc_pattern" in config:
                    running = self.is_process_running(config["proc_pattern"])
                else:
                    running = self.is_port_open(config["port"])

                status_emoji = "🟢" if running else ("⚠️" if infra_failure else "🔴")
                statuses.append(status_emoji)

                # Update menu item label correctly through the dictionary
                item_data = self.menu_items.get(name)
                if item_data:
                    action = "Stop" if running else "Start"
                    new_title = f"{status_emoji} {action} {name}"
                    old_title = item_data["current_title"]

                    if old_title != new_title:
                        print(
                            f"Syncing {name}: UI='{old_title}' -> Actual='{new_title}'"
                        )
                        # Update both the object and the reference tracking
                        item_data["item"].title = new_title
                        item_data["current_title"] = new_title

                    # --- WATCHDOG LOGIC ---
                    if not running and config.get("auto_restart"):
                        now = time.time()
                        hist = self.restart_history.get(name, {"last_attempt": 0, "count": 0})
                        
                        # Only attempt restart if it's been down for 30s or it's the first crash
                        # and don't restart more than 5 times in 5 minutes (simple backoff)
                        if now - hist["last_attempt"] > 30:
                            if hist["count"] < 5 or (now - hist["last_attempt"] > 300):
                                if hist["count"] >= 5: hist["count"] = 0 # reset count after 5 min
                                
                                print(f"Watchdog: Attempting auto-restart for {name}...")
                                self.start_service(name)
                                hist["last_attempt"] = now
                                hist["count"] += 1
                                self.restart_history[name] = hist

            except Exception as e:
                print(f"Check failed for {name}: {e}")
                statuses.append("🔴")

        self.title = f"Control [{' '.join(statuses)}]"
        self.status_header.title = (
            f"Last Check: {datetime.datetime.now().strftime('%H:%M:%S')}"
        )

    def open_dashboard(self, _):
        cfg = SERVICES["Paperclip"]
        if not self.is_port_open(cfg["port"]):
            self.start_service("Paperclip")
        self.ensure_https_gateway_server()
        url = DASHBOARD_BROWSER_URL
        if not url.endswith("/"):
            url = f"{url}/"
        for _ in range(25):
            if self.is_port_open(cfg["port"]):
                webbrowser.open(url)
                return
            time.sleep(0.15)
        rumps.alert(
            title="Dashboard",
            message=(
                f"Could not reach Paperclip on port {cfg['port']}.\n\n"
                f"Browser URL is {DASHBOARD_BROWSER_URL} (override with "
                "MVP_FACTORY_CONTROL_DASHBOARD_BROWSER_URL).\n"
                f"TLS health checks still use https://127.0.0.1:{HTTPS_GATEWAY_PORT}/dashboard/api/health."
            ),
        )

    def open_docs(self, _):
        webbrowser.open(f"file://{os.path.join(REPO_ROOT, 'docs/WIKI.md')}")

    def ensure_env_variables_server(self):
        if self.is_port_open(ENV_VARIABLES_PORT):
            return
        if not os.path.isfile(ENV_SERVER_PY):
            print(f"Env UI server missing: {ENV_SERVER_PY}")
            return
        py = None
        venv_py = os.path.join(REPO_ROOT, ".venv", "bin", "python3")
        for candidate in (
            venv_py if os.path.isfile(venv_py) else None,
            "/opt/homebrew/bin/python3.11",
            "/opt/homebrew/bin/python3.12",
            "/opt/homebrew/bin/python3",
            shutil.which("python3"),
        ):
            if candidate and os.path.isfile(candidate):
                py = candidate
                break
        if not py:
            py = "python3"
        log_file = open("/tmp/mvp-env-variables.log", "a")
        log_file.write(
            f"\n--- Starting env-variables UI {datetime.datetime.now()} ---\n"
        )
        log_file.flush()
        env = os.environ.copy()
        env["MVP_ENV_UI_PORT"] = str(ENV_VARIABLES_PORT)
        try:
            subprocess.Popen(
                [py, ENV_SERVER_PY],
                cwd=ENV_SERVER_DIR,
                stdout=log_file,
                stderr=log_file,
                env=env,
                start_new_session=True,
            )
        except Exception as e:
            print(f"Failed to start env-variables server: {e}")

    def ensure_https_gateway_server(self):
        if self.is_port_open(HTTPS_GATEWAY_PORT):
            return
        if not os.path.isfile(HTTPS_GATEWAY_PY):
            print(f"HTTPS gateway missing: {HTTPS_GATEWAY_PY}")
            return
        py = None
        venv_py = os.path.join(REPO_ROOT, ".venv", "bin", "python3")
        for candidate in (
            venv_py if os.path.isfile(venv_py) else None,
            "/opt/homebrew/bin/python3.11",
            "/opt/homebrew/bin/python3.12",
            "/opt/homebrew/bin/python3",
            shutil.which("python3"),
        ):
            if candidate and os.path.isfile(candidate):
                py = candidate
                break
        if not py:
            py = "python3"
        log_file = open("/tmp/mvp-https-gateway.log", "a")
        log_file.write(
            f"\n--- Starting HTTPS gateway {datetime.datetime.now()} ---\n"
        )
        log_file.flush()
        env = os.environ.copy()
        env["MVP_HTTPS_GATEWAY_PORT"] = str(HTTPS_GATEWAY_PORT)
        try:
            subprocess.Popen(
                [py, HTTPS_GATEWAY_PY],
                cwd=HTTPS_GATEWAY_DIR,
                stdout=log_file,
                stderr=log_file,
                env=env,
                start_new_session=True,
            )
        except Exception as e:
            print(f"Failed to start HTTPS gateway: {e}")

    def open_variables(self, _):
        self.ensure_env_variables_server()
        self.ensure_https_gateway_server()
        for _ in range(25):
            if self.is_port_open(ENV_VARIABLES_PORT) and self.is_port_open(HTTPS_GATEWAY_PORT):
                webbrowser.open(f"https://127.0.0.1:{HTTPS_GATEWAY_PORT}/variables/")
                return
            time.sleep(0.15)
        rumps.alert(
            title="Environment Variables",
            message=(
                "Could not start the local env UI on port %s.\n\n"
                "Install dependencies:\n"
                "  pip3 install -r scripts/env-variables/requirements.txt\n\n"
                "Log: /tmp/mvp-env-variables.log"
            )
            % ENV_VARIABLES_PORT,
        )

    def ensure_settings_panel_server(self):
        if self.is_port_open(SETTINGS_PANEL_PORT):
            return
        if not os.path.isfile(SETTINGS_PANEL_PY):
            print(f"Settings panel missing: {SETTINGS_PANEL_PY}")
            return
        py = None
        venv_py = os.path.join(REPO_ROOT, ".venv", "bin", "python3")
        for candidate in (
            venv_py if os.path.isfile(venv_py) else None,
            "/opt/homebrew/bin/python3.11",
            "/opt/homebrew/bin/python3.12",
            "/opt/homebrew/bin/python3",
            shutil.which("python3"),
        ):
            if candidate and os.path.isfile(candidate):
                py = candidate
                break
        if not py:
            py = "python3"
        log_file = open("/tmp/mvp-settings-panel.log", "a")
        log_file.write(
            f"\n--- Starting settings panel {datetime.datetime.now()} ---\n"
        )
        log_file.flush()
        env = os.environ.copy()
        env["MVP_SETTINGS_PANEL_PORT"] = str(SETTINGS_PANEL_PORT)
        try:
            subprocess.Popen(
                [py, SETTINGS_PANEL_PY],
                cwd=SETTINGS_PANEL_DIR,
                stdout=log_file,
                stderr=log_file,
                env=env,
                start_new_session=True,
            )
        except Exception as e:
            print(f"Failed to start settings panel: {e}")

    def open_settings(self, _):
        self.ensure_settings_panel_server()
        self.ensure_https_gateway_server()
        for _ in range(25):
            if self.is_port_open(SETTINGS_PANEL_PORT) and self.is_port_open(HTTPS_GATEWAY_PORT):
                webbrowser.open(f"https://127.0.0.1:{HTTPS_GATEWAY_PORT}/settings/")
                return
            time.sleep(0.15)
        rumps.alert(
            title="Settings",
            message=(
                "Could not start the local settings panel on port %s.\n\n"
                "Install dependencies:\n"
                "  pip3 install -r scripts/env-variables/requirements.txt\n\n"
                "Log: /tmp/mvp-settings-panel.log"
            )
            % SETTINGS_PANEL_PORT,
        )

    def open_connectors(self, _):
        cfg = SERVICES["AgentConnector"]
        if not self.is_port_open(cfg["port"]):
            self.start_service("AgentConnector")
        self.ensure_https_gateway_server()

        for _ in range(25):
            if self.is_port_open(cfg["port"]) and self.is_port_open(HTTPS_GATEWAY_PORT):
                webbrowser.open(f"https://127.0.0.1:{HTTPS_GATEWAY_PORT}/connectors/")
                return
            time.sleep(0.15)
        rumps.alert(
            title="Connector Error",
            message="Could not start the Agent Connector server on port 3198.",
        )

    def check_updates(self, _):
        print("Checking for updates...")
        try:
            # Sync with remote main branch
            git_bin = "/opt/homebrew/bin/git"
            subprocess.run([git_bin, "fetch", "origin"], cwd=REPO_ROOT, check=True)
            status = subprocess.check_output(
                [git_bin, "status", "-uno"], cwd=REPO_ROOT
            ).decode()

            if "Your branch is behind" in status:
                if (
                    rumps.alert(
                        title="Update Available",
                        message="A new version of the Factory is available. Would you like to update now?",
                        ok="Yes",
                        cancel="No",
                    )
                    == 1
                ):
                    rumps.notification(
                        "Factory Update",
                        "Starting Pull...",
                        "Downloading latest v1.4.1-sovereign code.",
                    )
                    subprocess.run(
                        [git_bin, "pull", "origin", "main"], cwd=REPO_ROOT, check=True
                    )

                    rumps.notification(
                        "Factory Update",
                        "Bootstrapping...",
                        "Synchronizing environments and launchers.",
                    )
                    # Run bootstrap in background to avoid blocking
                    subprocess.run(
                        ["/bin/bash", os.path.join(REPO_ROOT, "scripts/bootstrap.sh")],
                        cwd=REPO_ROOT,
                    )

                    rumps.notification(
                        "Factory Update",
                        "Restarting...",
                        "The Sovereign Watchdog is restarting the Control App.",
                    )
                    time.sleep(2)
                    import sys

                    sys.exit(0)  # Watchdog (plist) will instantly restart us
            else:
                rumps.alert(
                    title="Up to Date",
                    message="You are running the latest version of the Factory (v1.4.1-sovereign).",
                )
        except Exception as e:
            rumps.alert(
                title="Update Error", message=f"Failed to check for updates: {e}"
            )

    def toggle_infrastructure(self, _):
        if self.is_daemon_running():
            if (
                rumps.alert(
                    title="Restart Docker Infrastructure?",
                    message="This will reset Colima and may affect running containers. Proceed?",
                    ok="Yes",
                    cancel="No",
                )
                == 1
            ):
                rumps.notification(
                    "Infrastructure",
                    "Restarting Docker...",
                    "Colima is re-initializing.",
                )
                subprocess.run(["/opt/homebrew/bin/colima", "restart"])
        else:
            rumps.notification(
                "Infrastructure", "Starting Docker...", "Provisioning Colima VM."
            )
            subprocess.run(
                ["/opt/homebrew/bin/colima", "start", "--cpu", "4", "--memory", "8"]
            )
        self.check_status()

    def toggle_service(self, sender):
        # Determine name from the actual title
        name = None
        for k, v in self.menu_items.items():
            if v["current_title"] == sender.title:
                name = k
                break

        if not name:
            return
        config = SERVICES[name]

        running = False
        if config.get("is_docker"):
            running, _ = self.is_docker_running(config["docker_name"])
        else:
            running = self.is_port_open(config["port"])

        if running:
            self.stop_service(name)
        else:
            self.start_service(name)

        self.check_status()

    def start_service(self, name):
        config = SERVICES[name]
        cwd = config.get("cwd", REPO_ROOT)

        # Defensive check: if the directory doesn't exist, we don't start it
        if not os.path.exists(cwd):
            print(f"⚠️  Skipping {name}: Directory {cwd} not found.")
            return

        if config.get("is_docker"):
            running, _ = self.is_docker_running(config["docker_name"])
            if running:
                print(f"Skipping {name}: already running.")
                return
        elif config.get("port") == 0 and "proc_pattern" in config:
            if self.is_process_running(config["proc_pattern"]):
                print(f"Skipping {name}: daemon already running.")
                return
        elif self.is_port_open(config["port"]):
            print(f"Skipping {name}: port {config['port']} already in use.")
            return

        print(f"Starting {name} in {cwd}...")
        if config.get("is_docker"):
            # Redirect Docker compose output to a dedicated log
            log_file = open(f"/tmp/control-{name.lower()}.log", "a")
            log_file.write(
                f"\n--- Managing Docker container {name} at {datetime.datetime.now()} ---\n"
            )
            log_file.flush()

            # Use 'docker compose up -d' for the specific service
            # This ensures that 'unless-stopped' and CMD from .yml are applied
            cmd = [
                "/opt/homebrew/bin/docker",
                "compose",
                "up",
                "-d",
                config["docker_name"],
            ]
            print(f"Running: {' '.join(cmd)}")
            try:
                subprocess.Popen(
                    cmd, cwd=cwd, env=os.environ, stdout=log_file, stderr=log_file
                )
            except Exception as e:
                print(f"Error managing Docker {name}: {e}")
        else:
            # Redirect stdout and stderr to a service-specific log file
            log_file = open(f"/tmp/control-{name.lower()}.log", "a")
            log_file.write(f"\n--- Starting {name} at {datetime.datetime.now()} ---\n")
            log_file.flush()

            env = os.environ.copy()
            env.update(config.get("env", {}))

            proc = subprocess.Popen(
                config["cmd"],
                cwd=cwd,
                stdout=log_file,
                stderr=log_file,
                env=env,
                preexec_fn=os.setsid,
            )
            self.processes[name] = proc

    def stop_service(self, name):
        print(f"Stopping {name}...")
        if name in self.processes:
            try:
                proc = self.processes[name]
                if proc.poll() is None:
                    os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            except ProcessLookupError:
                pass  # Already gone
            del self.processes[name]
        elif SERVICES[name].get("is_docker"):
            docker_host = (
                f"unix://{os.path.expanduser('~')}/.colima/default/docker.sock"
            )
            subprocess.run(
                [
                    "/opt/homebrew/bin/docker",
                    "-H",
                    docker_host,
                    "stop",
                    SERVICES[name]["docker_name"],
                ],
                env=os.environ,
            )
        else:
            # Fallback: kill by port if it's not in our tracking (e.g. orphan)
            port = SERVICES[name]["port"]
            subprocess.run(f"lsof -ti:{port} | xargs kill -9 2>/dev/null", shell=True)

    def start_all(self, _=None):
        for name in SERVICES:
            if name == "Docker" or not (
                self.is_port_open(SERVICES[name]["port"])
                or (
                    SERVICES[name].get("is_docker")
                    and self.is_docker_running(SERVICES[name]["docker_name"])
                )
            ):
                self.start_service(name)

    @rumps.clicked("Restart All")
    def restart_all(self, _=None):
        for name in SERVICES:
            self.stop_service(name)
        time.sleep(2)
        self.start_all()

    def stop_all_services(self, _=None):
        print("Stopping all services for shutdown...")
        for name in list(SERVICES.keys()):
            self.stop_service(name)
        time.sleep(1)

    @rumps.clicked("Quit")
    def quit_app(self, _):
        self.stop_all_services()
        print("Sovereign Control shutdown complete. (Exit 0)")
        # os._exit(0) ensures the process terminates immediately without further rumps event handling
        # and satisfies the SuccessfulExit launchd condition.
        os._exit(0)


if __name__ == "__main__":
    app = ControlApp()
    # Handle signals for clean termination from launchd/system
    signal.signal(signal.SIGTERM, app.quit_app)
    signal.signal(signal.SIGINT, app.quit_app)
    app.run()
