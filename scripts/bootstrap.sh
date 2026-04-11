#!/usr/bin/env bash
#
# MVP Factory — local-first bootstrap (zero-config installer).
# - Resolves REPO_ROOT, optional sibling ../paperclip, Python .venv, Node deps for apps/mvp-factory-control
# - Installs LaunchAgent plist, Control.app wrapper, Prisma generate/migrate when DB available
# - Documents missing pieces (Paperclip, Postgres) without hard-failing the whole script
#
set -euo pipefail

# --- Configuration & Discovery ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APPS_DIR="$REPO_ROOT/apps"
CONTROL_APP_DIR="$APPS_DIR/mvp-factory-control"
PAPERCLIP_DIR="$(cd "$REPO_ROOT/../paperclip" 2>/dev/null && pwd || echo "")"
VIRTUAL_ENV="$REPO_ROOT/.venv"
LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
PLIST_NAME="com.moldovancsaba.control-mvp.plist"
PLIST_SOURCE="$SCRIPT_DIR/$PLIST_NAME"

# --- Discovery Validation ---
if [ -z "$PAPERCLIP_DIR" ] || [ ! -d "$PAPERCLIP_DIR" ]; then
  echo -e "\n⚠️  WARNING: Sibling 'paperclip' repository not found."
  echo "👉 Dashboard features (Paperclip via the local HTTPS gateway) will be unavailable."
  echo "👉 To enable the full factory, clone 'paperclip' into the same parent folder as this repo."
  echo -e "--------------------------------------------------------\n"
fi

# --- 1. Active Dependency Pull ---
echo "⚙️  Pulling System Dependencies (Homebrew)..."

# Ensure Homebrew is installed
if ! command -v brew >/dev/null 2>&1; then
  echo "📦 Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# List of required packages
PACKAGES=(
  "docker"
  "colima"
  "ollama"
  "node"
  "python@3.11"
  "gh"
  "jq"
)

for pkg in "${PACKAGES[@]}"; do
  if ! brew list "$pkg" >/dev/null 2>&1; then
    echo "📦 Installing $pkg..."
    brew install "$pkg"
  else
    echo "✅ Already installed: $pkg"
  fi
done

# --- 2. Local AI & Docker Startup ---
echo -e "\n🕹️  Launching Infrastructure..."

# Start Colima if not running (preferred for local macOS Docker)
if ! colima status >/dev/null 2>&1; then
  echo "🐳 Starting Colima..."
  colima start --edit=false --cpu 4 --memory 8
else
  echo "✅ Colima is running."
fi

# Start Ollama (Serve)
if ! pgrep -x "ollama" >/dev/null; then
  echo "🧠 Starting Ollama..."
  nohup ollama serve >/tmp/ollama.log 2>&1 &
  sleep 5
else
  echo "✅ Ollama is running."
fi

# Pull Default Models
echo "🧠 Ensuring default models are present..."
ollama pull gemma4:latest
echo "✅ Default models pulled."

# --- 3. Environment & Workspace Initialization ---
echo -e "\n📂 Initializing Workspaces..."

init_env() {
  local dir="$1"
  local target=".env"
  local example=".env.example"
  
  if [ ! -d "$dir" ]; then return; fi
  
  if [ ! -f "$dir/$target" ]; then
    if [ -f "$dir/$example" ]; then
      cp "$dir/$example" "$dir/$target"
      echo "✅ Created $target from example in $(basename "$dir")"
      
      # Auto-Populate some defaults
      if [[ "$dir" == *"/mvp-factory-control"* ]]; then
        sed -i '' "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$(openssl rand -base64 32)|g" "$dir/$target"
        sed -i '' "s|moldovancsaba|$USER|g" "$dir/$target"
      fi
    fi
  else
    echo "✅ $target exists in $(basename "$dir")"
  fi
}

init_env "$CONTROL_APP_DIR"
if [ -n "$PAPERCLIP_DIR" ]; then init_env "$PAPERCLIP_DIR"; fi

# --- 4. Language Runtimes ---
echo -e "\n📦 Installing Language Dependencies..."

# Python Venv
if [ ! -d "$REPO_ROOT/.venv" ]; then
  python3 -m venv "$REPO_ROOT/.venv"
fi
source "$REPO_ROOT/.venv/bin/activate"
pip install --upgrade pip >/dev/null
pip install rumps py2app >/dev/null
if [ -f "$REPO_ROOT/scripts/env-variables/requirements.txt" ]; then
  pip install -r "$REPO_ROOT/scripts/env-variables/requirements.txt" >/dev/null
  echo "✅ Env Variables UI (FastAPI) dependencies installed."
fi
echo "✅ Python virtual environment ready."

# Node Modules
if [ -d "$CONTROL_APP_DIR" ]; then
  (cd "$CONTROL_APP_DIR" && npm install >/dev/null)
  echo "✅ Node.js modules installed."
fi

# AI Agents & CLI Resources
echo -e "\n🤖 Installing Local AI Agents..."
if ! command -v pi >/dev/null 2>&1; then
  echo "📦 Installing Pi Coding Agent..."
  npm install -g @mariozechner/pi-coding-agent >/dev/null
  echo "✅ Pi installed."
else
  echo "✅ Pi is already installed."
fi

if ! command -v hermes >/dev/null 2>&1; then
  echo "📦 Installing Hermes Agent..."
  curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash >/dev/null
  echo "✅ Hermes installed."
else
  echo "✅ Hermes is already installed."
fi

# --- 5. Persistence Automation ---
echo -e "\n🛠️  Automating Persistence (LaunchAgent)..."

if [ -f "$PLIST_SOURCE" ]; then
  # Ensure no stale control script is running
  pgrep -f "control_mvp.py" | xargs kill -9 2>/dev/null || true
  
  mkdir -p "$LAUNCH_AGENT_DIR"
  cp "$PLIST_SOURCE" "$LAUNCH_AGENT_DIR/$PLIST_NAME"
  
  # Fix hardcoded paths in plist
  sed -i '' "s|/Users/moldovancsaba/Projects/mvp-factory-control|$REPO_ROOT|g" "$LAUNCH_AGENT_DIR/$PLIST_NAME"
  
  # Purge any legacy 'control.mvp.app' to prevent Spotlight confusion
  echo "🧹 Cleaning legacy application artifacts..."
  rm -rf "/Applications/control.mvp.app" ~/Applications/control.mvp.app 2>/dev/null || true
  
  launchctl bootout gui/$(id -u)/com.moldovancsaba.control-mvp 2>/dev/null || true
  launchctl bootstrap gui/$(id -u) "$LAUNCH_AGENT_DIR/$PLIST_NAME"
  # Use kickstart to ensure it's running immediately
  launchctl kickstart -kp gui/$(id -u)/com.moldovancsaba.control-mvp
  echo "✅ Sovereign Watchdog (24/7/365 availability) installed and active."
else
  echo "⚠️  LaunchAgent source not found at $PLIST_SOURCE"
fi

# 5. Create Premium macOS App Bundle (Spotlight support)
echo -e "\n🏗️  Designing Premium macOS App..."
# Ensure py2app or osacompile environment is ready
"$VIRTUAL_ENV/bin/python3" "$REPO_ROOT/scripts/create_app_wrapper.py"
echo "✅ Control App installed to /Applications."

# Clear Spotlight Cache (Optional but helpful)
# mdutil -E /Applications > /dev/null 2>&1 || true

# --- 6. Verification Loop ---
echo -e "\n🔍 Verifying Factory Readiness..."

check_port() {
  local port="$1"
  local count=0
  until nc -z localhost "$port"; do
    ((count++))
    if [ $count -gt 30 ]; then return 1; fi
    sleep 2
  done
  return 0
}

GW_PORT="${MVP_HTTPS_GATEWAY_PORT:-3443}"

if [ -n "$PAPERCLIP_DIR" ] && [ -d "$PAPERCLIP_DIR" ] && check_port 3100; then
  python3 -c "import sys; sys.path.insert(0, '$REPO_ROOT/scripts'); from local_tls import ensure_loopback_certificate; ensure_loopback_certificate('$REPO_ROOT')" 2>/dev/null || true
  if ! (echo >/dev/tcp/127.0.0.1/"$GW_PORT") &>/dev/null; then
    echo "Starting local HTTPS gateway on 127.0.0.1:${GW_PORT}..."
    MVP_HTTPS_GATEWAY_PORT="$GW_PORT" nohup python3 "$REPO_ROOT/scripts/https-gateway/server.py" >>/tmp/mvp-https-gateway.log 2>&1 &
    disown 2>/dev/null || true
    sleep 0.5
  fi
  echo -e "\n✨ FACTORY READY ✨"
  echo "--------------------------------------------------------"
  echo "The MVP Factory is now fully autonomous."
  echo "👉 Paperclip (HTTPS only): https://127.0.0.1:${GW_PORT}/dashboard/"
  echo "👉 Monitoring: macOS Menu Bar icon (Control.app also keeps the gateway running)"
  echo "--------------------------------------------------------"
  open "https://127.0.0.1:${GW_PORT}/dashboard/"
else
  echo -e "\n✨ CONTROL READY (LITE) ✨"
  echo "--------------------------------------------------------"
  echo "The Factory Watcher is now active via 'Control.app'."
  echo "⚠️  Full Dashboard requires the 'paperclip' repository."
  echo "👉 Monitoring: macOS Menu Bar icon"
  echo "--------------------------------------------------------"
fi
