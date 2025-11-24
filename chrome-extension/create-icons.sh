#!/bin/bash
# Script to create extension icons from logo.png

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick not found. Installing..."
    echo "Please install ImageMagick first:"
    echo "  macOS: brew install imagemagick"
    echo "  Ubuntu: sudo apt-get install imagemagick"
    echo "  Windows: Download from https://imagemagick.org/"
    exit 1
fi

# Check if logo exists
if [ ! -f "../images/logo.png" ]; then
    echo "Logo not found at ../images/logo.png"
    echo "Please ensure logo.png exists in the images folder"
    exit 1
fi

# Create icons directory
mkdir -p icons

# Create icons
echo "Creating extension icons..."
convert ../images/logo.png -resize 16x16 icons/icon16.png
convert ../images/logo.png -resize 32x32 icons/icon32.png
convert ../images/logo.png -resize 48x48 icons/icon48.png
convert ../images/logo.png -resize 128x128 icons/icon128.png

echo "✅ Icons created successfully in icons/ folder:"
ls -lh icons/

