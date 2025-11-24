#!/usr/bin/env python3
"""
Create Chrome extension icons from logo.png
Requires Pillow: pip install Pillow
"""

import os
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow not found. Installing...")
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

def create_icons():
    # Paths
    base_dir = Path(__file__).parent
    logo_path = base_dir.parent / "images" / "logo.png"
    icons_dir = base_dir / "icons"
    
    # Check if logo exists
    if not logo_path.exists():
        print(f"❌ Logo not found at: {logo_path}")
        print("Please ensure logo.png exists in ../images/ folder")
        return False
    
    # Create icons directory
    icons_dir.mkdir(exist_ok=True)
    
    # Sizes needed
    sizes = [16, 32, 48, 128]
    
    try:
        # Open and resize logo
        logo = Image.open(logo_path)
        
        print("Creating extension icons...")
        for size in sizes:
            # Resize with high quality
            icon = logo.resize((size, size), Image.Resampling.LANCZOS)
            icon_path = icons_dir / f"icon{size}.png"
            icon.save(icon_path, "PNG")
            print(f"  ✅ Created icon{size}.png ({size}x{size})")
        
        print(f"\n✅ All icons created successfully in {icons_dir}/")
        return True
        
    except Exception as e:
        print(f"❌ Error creating icons: {e}")
        return False

if __name__ == "__main__":
    print("🎨 Chrome Extension Icon Generator\n")
    success = create_icons()
    if success:
        print("\n📦 Next step: Load the extension in Chrome")
        print("   1. Go to chrome://extensions/")
        print("   2. Enable 'Developer mode'")
        print("   3. Click 'Load unpacked'")
        print("   4. Select the chrome-extension folder")
    else:
        print("\n❌ Failed to create icons. Please check errors above.")

