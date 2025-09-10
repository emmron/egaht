#!/bin/bash

# Script to remove unnecessary package.json files
# Keeps only essential ones for backward compatibility

echo "🧹 Cleaning up package.json files..."

# List of package.json files to KEEP (for legacy compatibility)
KEEP_FILES=(
  "./package.json"  # Root package.json for npm compatibility
  "./typescript-dts/package.json"  # For TypeScript definitions
)

# Find all package.json files
ALL_FILES=$(find . -name "package.json" -type f 2>/dev/null | grep -v node_modules)

# Count files
TOTAL=$(echo "$ALL_FILES" | wc -l)
REMOVED=0

# Process each file
for file in $ALL_FILES; do
  SHOULD_KEEP=false
  
  # Check if it's in the keep list
  for keep in "${KEEP_FILES[@]}"; do
    if [[ "$file" == "$keep" ]]; then
      SHOULD_KEEP=true
      break
    fi
  done
  
  if [ "$SHOULD_KEEP" = false ]; then
    echo "  Removing: $file"
    rm "$file"
    REMOVED=$((REMOVED + 1))
  else
    echo "  Keeping: $file (legacy compatibility)"
  fi
done

echo ""
echo "✅ Cleanup complete!"
echo "  Total files found: $TOTAL"
echo "  Files removed: $REMOVED"
echo "  Files kept: $((TOTAL - REMOVED))"