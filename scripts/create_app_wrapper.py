"""
Builds Control.app in /Applications: generates .icns from assets/icon.png, bundles control_mvp.py launcher.
Run manually or from bootstrap when packaging the menu bar app.
"""
import os
import subprocess
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(REPO_ROOT, "assets")
ICON_PNG = os.path.join(ASSETS_DIR, "icon.png")
ICONSET_DIR = os.path.join(ASSETS_DIR, "icon.iconset")
ICON_ICNS = os.path.join(ASSETS_DIR, "icon.icns")
APP_PATH = "/Applications/Control.app"

def create_icns():
    print("🎨 Creating .icns from icon.png...")
    os.makedirs(ICONSET_DIR, exist_ok=True)
    
    # Generate standard macOS icon sizes
    sizes = [16, 32, 64, 128, 256, 512]
    for size in sizes:
        # Normal resolution
        out = os.path.join(ICONSET_DIR, f"icon_{size}x{size}.png")
        subprocess.run(["sips", "-s", "format", "png", "-z", str(size), str(size), ICON_PNG, "--out", out], check=True)
        # High resolution (@2x)
        out_2x = os.path.join(ICONSET_DIR, f"icon_{size}x{size}@2x.png")
        subprocess.run(["sips", "-s", "format", "png", "-z", str(size*2), str(size*2), ICON_PNG, "--out", out_2x], check=True)
            
    print(f"📦 Running iconutil on {ICONSET_DIR}...")
    subprocess.run(["iconutil", "-c", "icns", ICONSET_DIR, "-o", ICON_ICNS], check=True)
    subprocess.run(["rm", "-rf", ICONSET_DIR])
    print(f"✅ Created {ICON_ICNS}")

def create_app_bundle():
    print("🏗️  Creating macOS App Bundle...")
    # Use osacompile to create a thin AppleScript applet
    applescript = f'do shell script "bash {REPO_ROOT}/scripts/launch.sh" with administrator privileges'
    # Use a simpler version that doesn't need sudo if launch.sh doesn't need it
    applescript = f'do shell script "bash {REPO_ROOT}/scripts/launch.sh"'
    
    subprocess.run(["osacompile", "-o", APP_PATH, "-e", applescript], check=True)
    
    # 2. Add the icon to the bundle
    dest_icon = os.path.join(APP_PATH, "Contents/Resources/applet.icns")
    subprocess.run(["cp", ICON_ICNS, dest_icon], check=True)
    
    # 3. Update the Info.plist to make it look professional
    plist_path = os.path.join(APP_PATH, "Contents/Info.plist")
    subprocess.run(["defaults", "write", plist_path, "CFBundleName", "Control"], check=True)
    subprocess.run(["defaults", "write", plist_path, "CFBundleDisplayName", "Control"], check=True)
    subprocess.run(["defaults", "write", plist_path, "CFBundleIdentifier", "com.moldovancsaba.control-launcher"], check=True)
    
    print(f"✅ Created {APP_PATH}")

if __name__ == "__main__":
    try:
        create_icns()
        create_app_bundle()
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
