# Quick Start Guide - Chrome Extension

## 🚀 3-Step Setup

### Step 1: Create Icons

Run the icon generation script:
```bash
cd chrome-extension
./create-icons.sh
```

**Or manually** using any image editor:
- Resize `../images/logo.png` to:
  - `icons/icon16.png` (16x16)
  - `icons/icon32.png` (32x32)
  - `icons/icon48.png` (48x48)
  - `icons/icon128.png` (128x128)

### Step 2: Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `chrome-extension` folder
5. Extension icon should appear in Chrome toolbar

### Step 3: Use Extension

1. Navigate to any webpage
2. Click the **SellOnLLM extension icon** in toolbar
3. View instant LLM audit results!

## ✅ Done!

The extension will now:
- Automatically audit any page you visit
- Show overall LLM readiness score (0-100)
- Highlight what's missing
- Provide recommendations for each check

## 🐛 Troubleshooting

**Extension not working?**
- Make sure icons are created (check `icons/` folder)
- Check Chrome console for errors: Right-click extension icon → "Inspect popup"
- Reload extension: `chrome://extensions/` → Click refresh icon

**Icons missing?**
- Run `./create-icons.sh` or manually create icons (see Step 1)
- Extension requires all 4 icon sizes

## 📝 Next Steps

- Test on various websites
- Share with your team
- Get feedback and iterate

For full documentation, see `README.md`

