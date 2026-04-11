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
# Paperclip dev is started with PAPERCLIP_PUBLIC_BASE_PATH=/dashboard; prefer HTTPS gateway URL.
DASHBOARD_BROWSER_URL = (
    os.environ.get(
        "MVP_FACTORY_CONTROL_DASHBOARD_BROWSER_URL",
        f"https://127.0.0.1:{HTTPS_GATEWAY_PORT}/dashboard/",
    ).strip()
    or f"https://127.0.0.1:{HTTPS_GATEWAY_PORT}/dashboard/"
)
RUNTIME_STATE_DIR = os.path.join(REPO_ROOT, ".mvp-factory-control")
APP_SETTINGS_PATH = os.path.join(RUNTIME_STATE_DIR, "settings.json")
CONTROL_PANEL_SETTINGS_PATH = os.path.join(RUNTIME_STATE_DIR, "control-panel-settings.json")
TLS_DIR = os.path.join(RUNTIME_STATE_DIR, "tls")
TLS_CERT_PATH = os.path.join(TLS_DIR, "localhost-cert.pem")
PYTHON_CMD = sys.executable
SERVICE_START_GRACE_SECONDS = 20


def ensure_loopback_tls_material():
    """Create ``localhost-cert.pem`` / key under ``.mvp-factory-control/tls`` if missing."""
    try:
        scripts_dir = os.path.join(REPO_ROOT, "scripts")
        if scripts_dir not in sys.path:
            sys.path.insert(0, scripts_dir)
        from local_tls import ensure_loopback_certificate

        ensure_loopback_certificate(REPO_ROOT)
    except Exception as exc:
        print(f"Warning: ensure_loopback_tls_material failed: {exc}")


def load_json_file(path, default):
    if not os.path.isfile(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Failed to load json file {path}: {exc}")
        return default


def default_solutions_flags():
    return {
        "paperclip": True,
        "openCode": True,
        "ollama": True,
        "scrumMaster": True,
        "agentConnector": True,
        "checklistSync": True,
    }


_CONTROL_PANEL_PATH_KEYS = (
    "sharedRoot",
    "paperclipRoot",
    "checklistRoot",
    "checklistEnvPath",
)


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
        merged = defaults.copy()
        merged["solutions"] = default_solutions_flags()
        return merged
    merged = defaults.copy()
    for key in _CONTROL_PANEL_PATH_KEYS:
        value = stored.get(key)
        if isinstance(value, str) and value.strip():
            merged[key] = os.path.abspath(os.path.expanduser(value.strip()))
    solutions = default_solutions_flags()
    sol_raw = stored.get("solutions")
    if isinstance(sol_raw, dict):
        for k in solutions:
            if k in sol_raw and isinstance(sol_raw[k], bool):
                solutions[k] = sol_raw[k]
    merged["solutions"] = solutions
    return merged


CONTROL_PANEL_SETTINGS = load_control_panel_settings()


def reload_control_panel_settings():
    global CONTROL_PANEL_SETTINGS
    CONTROL_PANEL_SETTINGS = load_control_panel_settings()


SERVICE_SOLUTION_KEY = {
    "Paperclip": "paperclip",
    "OpenCode": "openCode",
    "Ollama": "ollama",
    "ScrumMaster": "scrumMaster",
    "AgentConnector": "agentConnector",
    "ChecklistSync": "checklistSync",
}


def is_solution_enabled(service_name):
    sol = CONTROL_PANEL_SETTINGS.get("solutions")
    if not isinstance(sol, dict):
        return True
    key = SERVICE_SOLUTION_KEY.get(service_name)
    if not key:
        return True
    return bool(sol.get(key, True))
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
        "env": {
            "PAPERCLIP_PUBLIC_BASE_PATH": "/dashboard",
            "PAPERCLIP_PUBLIC_URL": f"https://127.0.0.1:{HTTPS_GATEWAY_PORT}/dashboard",
        },
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
        "proc_pattern": "node sync.js",
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
            "CHECKLIST_POLL_INTERVAL_MS": str(
                int(CONTROL_PANEL_SETTINGS.get("checklistPollIntervalSeconds", 300)) * 1000
            ),
            "CHECKLIST_FLASHCARD_REVISIT_INTERVAL_MINUTES": str(
                CONTROL_PANEL_SETTINGS.get("checklistFlashcardRevisitMinutes", 15)
            ),
            "CHECKLIST_FLASHCARD_REVISIT_BATCH_SIZE": str(
                CONTROL_PANEL_SETTINGS.get("checklistFlashcardRevisitBatchSize", 5)
            ),
            "CHECKLIST_TASK_REVISIT_INTERVAL_MINUTES": str(
                CONTROL_PANEL_SETTINGS.get("checklistTaskRevisitMinutes", 30)
            ),
            "CHECKLIST_TASK_REVISIT_BATCH_SIZE": str(
                CONTROL_PANEL_SETTINGS.get("checklistTaskRevisitBatchSize", 2)
            ),
            "CHECKLIST_FEEDBACK_REPLAY_INTERVAL_MINUTES": str(
                CONTROL_PANEL_SETTINGS.get("checklistFeedbackReplayMinutes", 30)
            ),
            "CHECKLIST_FEEDBACK_REPLAY_BATCH_SIZE": str(
                CONTROL_PANEL_SETTINGS.get("checklistFeedbackReplayBatchSize", 2)
            ),
            "CHECKLIST_HASHTAG_MAINTENANCE_HOURS": str(
                CONTROL_PANEL_SETTINGS.get("checklistHashtagMaintenanceHours", 24)
            ),
            "CHECKLIST_HASHTAG_MAINTENANCE_BATCH_SIZE": str(
                CONTROL_PANEL_SETTINGS.get("checklistHashtagMaintenanceBatchSize", 1)
            ),
            "CHECKLIST_CLEANUP_INTERVAL_HOURS": str(
                CONTROL_PANEL_SETTINGS.get("checklistCleanupHours", 24)
            ),
            "CHECKLIST_CLEANUP_BATCH_SIZE": str(
                CONTROL_PANEL_SETTINGS.get("checklistCleanupBatchSize", 25)
            ),
            "CHECKLIST_OLLAMA_TIMEOUT_MS": str(
                CONTROL_PANEL_SETTINGS.get("checklistOllamaTimeoutMs", 120000)
            ),
            "CHECKLIST_TASK_MIN_ICE_SCORE": str(
                CONTROL_PANEL_SETTINGS.get("checklistTaskMinIce", 100)
            ),
            "CHECKLIST_FLASHCARD_MIN_CONFIDENCE": str(
                CONTROL_PANEL_SETTINGS.get("checklistFlashcardMinConfidence", 60)
            ),
            "CHECKLIST_FLASHCARD_MIN_IMPACT": str(
                CONTROL_PANEL_SETTINGS.get("checklistFlashcardMinImpact", 40)
            ),
            "CHECKLIST_FLASHCARD_MIN_WEIGHT": str(
                CONTROL_PANEL_SETTINGS.get("checklistFlashcardMinWeight", 40)
            ),
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
        # Menu labels spell out HTTPS entrypoints (gateway); upstreams stay HTTP on loopback only.
        _gw = f"https://127.0.0.1:{HTTPS_GATEWAY_PORT}"
        self.dashboard_link = rumps.MenuItem(
            f"🌐 Paperclip · {_gw}/dashboard/",
            callback=self.open_dashboard,
        )
        self.docs_link = rumps.MenuItem(
            "📚 Documentation · local WIKI (file)",
            callback=self.open_docs,
        )
        self.variables_link = rumps.MenuItem(
            f"🔑 Env variables · {_gw}/variables/",
            callback=self.open_variables,
        )
        self.settings_link = rumps.MenuItem(
            f"⚙️ Settings · {_gw}/settings/",
            callback=self.open_settings,
        )
        self.checklist_settings_link = rumps.MenuItem(
            f"🧠 Checklist settings · {_gw}/settings/#checklist-settings",
            callback=self.open_checklist_settings,
        )
        self.connector_link = rumps.MenuItem(
            f"🤖 Connectors · {_gw}/connectors/",
            callback=self.open_connectors,
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
            self.checklist_settings_link,
            self.connector_link,
            self.update_link,
            None,
        ]
        self.processes = {}
        self.starting_services = {}

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
        self.menu.add(rumps.MenuItem("v1.4.1-sovereign"))

        # Initial status check before starting timer
        self.check_status()

        # Timer for health checks (every 10 seconds)
        self.timer = rumps.Timer(self.check_status, 10)
        self.timer.start()

        ensure_loopback_tls_material()
        # Keep the local HTTPS gateway available for browser entrypoints.
        self.ensure_https_gateway_server()
        self.ensure_env_variables_server()
        self.ensure_settings_panel_server()

        # Auto-start core services on launch
        rumps.notification(
            "Factory Control",
            "Initializing Core...",
            "Automatic bootstrap of enabled local services (see Factory Settings).",
        )
        for _name in (
            "Ollama",
            "Paperclip",
            "OpenCode",
            "ScrumMaster",
            "AgentConnector",
            "ChecklistSync",
        ):
            if is_solution_enabled(_name):
                self.start_service(_name)

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
        return len(self.find_process_pids(pattern)) > 0

    def find_process_pids(self, pattern):
        try:
            out = subprocess.check_output(["pgrep", "-f", pattern])
            return [int(line.strip()) for line in out.decode().splitlines() if line.strip()]
        except subprocess.CalledProcessError:
            return []
        except Exception:
            return []

    def check_status(self, _=None):
        reload_control_panel_settings()
        statuses = []
        daemon_up = self.is_daemon_running()
        infra_emoji = "🟢" if daemon_up else "🔴"
        self.infra_item.title = f"🐳 Docker Infrastructure: {infra_emoji} {'Active' if daemon_up else 'Down'}"

        pi_ok = self.is_cli_available("pi")
        hermes_ok = self.is_cli_available("hermes")
        self.cli_status_item.title = f"🤖 Agent CLIs: {'🟢' if pi_ok else '🔴'} Pi | {'🟢' if hermes_ok else '🔴'} Hermes"

        for name, config in SERVICES.items():
            try:
                enabled = is_solution_enabled(name)
                running = False
                infra_failure = False
                if config.get("is_docker"):
                    running, mode = self.is_docker_running(config["docker_name"])
                    if mode == "infrastructure_down":
                        infra_failure = True
                elif "proc_pattern" in config:
                    running = self.is_process_running(config["proc_pattern"])
                else:
                    running = self.is_port_open(config["port"])

                if running:
                    self.starting_services.pop(name, None)
                start_age = time.time() - self.starting_services.get(name, 0)
                is_starting = not running and 0 < start_age < SERVICE_START_GRACE_SECONDS

                if not enabled and not running:
                    status_emoji = "⏸"
                elif is_starting:
                    status_emoji = "🟡"
                elif running:
                    status_emoji = "🟢"
                elif infra_failure:
                    status_emoji = "⚠️"
                else:
                    status_emoji = "🔴"
                statuses.append(status_emoji)

                # Update menu item label correctly through the dictionary
                item_data = self.menu_items.get(name)
                if item_data:
                    action = "Stop" if running else "Start"
                    if not enabled and not running:
                        new_title = f"⏸ {action} {name} (off)"
                    elif is_starting:
                        new_title = f"🟡 Start {name} (starting)"
                    else:
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
                    if enabled and not running and not is_starting and config.get("auto_restart"):
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
        reload_control_panel_settings()
        if not is_solution_enabled("Paperclip"):
            rumps.alert(
                title="Paperclip disabled",
                message=(
                    "Paperclip is turned off in Factory Settings.\n\n"
                    f"Open https://127.0.0.1:{HTTPS_GATEWAY_PORT}/settings/ and enable Paperclip, "
                    "then wait a few seconds or start it from the menu."
                ),
            )
            return
        cfg = SERVICES["Paperclip"]
        if not self.is_port_open(cfg["port"]):
            self.start_service("Paperclip")
        self.ensure_https_gateway_server()
        url = DASHBOARD_BROWSER_URL
        if not url.endswith("/"):
            url = f"{url}/"
        for _ in range(50):
            if (
                self.is_port_open(cfg["port"])
                and self.is_port_open(HTTPS_GATEWAY_PORT)
            ):
                webbrowser.open(url)
                return
            time.sleep(0.15)
        rumps.alert(
            title="Dashboard",
            message=(
                f"Could not reach Paperclip on port {cfg['port']} and/or the HTTPS gateway on port {HTTPS_GATEWAY_PORT}.\n\n"
                f"Browser URL (HTTPS only): {DASHBOARD_BROWSER_URL}\n"
                "(override with MVP_FACTORY_CONTROL_DASHBOARD_BROWSER_URL).\n\n"
                "If the gateway failed to start, see /tmp/mvp-https-gateway.log"
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
        env["LOCAL_TLS_CERT_PATH"] = TLS_CERT_PATH
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
        ensure_loopback_tls_material()
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
        env["LOCAL_TLS_CERT_PATH"] = TLS_CERT_PATH
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

    def open_checklist_settings(self, _):
        self.ensure_settings_panel_server()
        self.ensure_https_gateway_server()
        for _ in range(25):
            if self.is_port_open(SETTINGS_PANEL_PORT) and self.is_port_open(HTTPS_GATEWAY_PORT):
                webbrowser.open(
                    f"https://127.0.0.1:{HTTPS_GATEWAY_PORT}/settings/#checklist-settings"
                )
                return
            time.sleep(0.15)
        rumps.alert(
            title="Checklist Settings",
            message=(
                "Could not start the local checklist settings panel on port %s.\n\n"
                "Install dependencies:\n"
                "  pip3 install -r scripts/env-variables/requirements.txt\n\n"
                "Log: /tmp/mvp-settings-panel.log"
            )
            % SETTINGS_PANEL_PORT,
        )

    def open_connectors(self, _):
        reload_control_panel_settings()
        if not is_solution_enabled("AgentConnector"):
            rumps.alert(
                title="Agent Connector disabled",
                message=(
                    "Agent Connector is turned off in Factory Settings.\n\n"
                    f"Open https://127.0.0.1:{HTTPS_GATEWAY_PORT}/settings/ to enable it."
                ),
            )
            return
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
        elif "proc_pattern" in config:
            running = self.is_process_running(config["proc_pattern"])
        else:
            running = self.is_port_open(config["port"])

        reload_control_panel_settings()
        if not running and not is_solution_enabled(name):
            rumps.alert(
                title=f"{name} off",
                message=(
                    f"{name} is disabled in Factory Settings "
                    f"(https://127.0.0.1:{HTTPS_GATEWAY_PORT}/settings/). "
                    "Enable it there, then try again."
                ),
            )
            self.check_status()
            return

        if running:
            self.stop_service(name)
        else:
            self.start_service(name)

        self.check_status()

    def start_service(self, name):
        reload_control_panel_settings()
        if not is_solution_enabled(name):
            print(f"Skipping {name}: disabled in Factory Settings (solutions).")
            return
        start_age = time.time() - self.starting_services.get(name, 0)
        if 0 < start_age < SERVICE_START_GRACE_SECONDS:
            print(f"Skipping {name}: startup already in progress.")
            return
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
        elif "proc_pattern" in config:
            if self.is_process_running(config["proc_pattern"]):
                print(f"Skipping {name}: daemon already running.")
                return
        elif self.is_port_open(config["port"]):
            print(f"Skipping {name}: port {config['port']} already in use.")
            return

        print(f"Starting {name} in {cwd}...")
        self.starting_services[name] = time.time()
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
                self.starting_services.pop(name, None)
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
        self.starting_services.pop(name, None)
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
        elif "proc_pattern" in SERVICES[name]:
            for pid in self.find_process_pids(SERVICES[name]["proc_pattern"]):
                try:
                    os.kill(pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
        else:
            # Fallback: kill by port if it's not in our tracking (e.g. orphan)
            port = SERVICES[name]["port"]
            subprocess.run(f"lsof -ti:{port} | xargs kill -9 2>/dev/null", shell=True)

    def start_all(self, _=None):
        for name in SERVICES:
            service = SERVICES[name]
            if service.get("is_docker"):
                running = self.is_docker_running(service["docker_name"])[0]
            elif "proc_pattern" in service:
                running = self.is_process_running(service["proc_pattern"])
            else:
                running = self.is_port_open(service["port"])
            if name == "Docker" or not running:
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
