#!/bin/bash
# Test script for totp CLI

set -e

echo "Testing TOTP CLI..."
echo

# Test 1: Generate secret
echo "✓ Testing generate..."
OUTPUT=$(./totp.mjs generate test@example.com TestApp)
SECRET=$(echo "$OUTPUT" | jq -r '.secret')
URI=$(echo "$OUTPUT" | jq -r '.uri')
echo "  Generated secret: $SECRET"

# Test 2: Get current code
echo "✓ Testing current..."
CODE=$(./totp.mjs current "$SECRET")
echo "  Current code: $CODE"

# Test 3: Validate that code
echo "✓ Testing validate (should be VALID)..."
if ./totp.mjs validate "$SECRET" "$CODE"; then
  echo "  Result: VALID ✓"
else
  echo "  Result: INVALID ✗"
  exit 1
fi

# Test 4: Validate invalid code
echo "✓ Testing validate (should be INVALID)..."
if ./totp.mjs validate "$SECRET" "000000"; then
  echo "  Result: VALID ✗ (expected INVALID)"
  exit 1
else
  echo "  Result: INVALID ✓"
fi

# Test 5: Generate URI
echo "✓ Testing URI generation..."
GEN_URI=$(./totp.mjs uri "$SECRET" test@example.com TestApp)
echo "  URI: $GEN_URI"

echo
echo "All tests passed! ✓"
