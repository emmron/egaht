#!/bin/bash
# Generate simple placeholder icons for the extension
# Agent 3 v2.0 - Getting things done!

# Create a simple SVG icon
cat > icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="0" y="0" width="128" height="128" rx="16" fill="#1e1e1e"/>
  <text x="64" y="64" font-family="Arial, sans-serif" font-size="48" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="#40c8ae">E</text>
  <circle cx="64" cy="64" r="54" fill="none" stroke="#40c8ae" stroke-width="4"/>
</svg>
EOF

echo "Simple SVG icon created. For production, convert to PNG at different sizes:"
echo "- 16x16 for icon-16.png"
echo "- 48x48 for icon-48.png"  
echo "- 128x128 for icon-128.png"
echo ""
echo "You can use ImageMagick or similar tools to convert:"
echo "convert -background transparent icon.svg -resize 16x16 icon-16.png"