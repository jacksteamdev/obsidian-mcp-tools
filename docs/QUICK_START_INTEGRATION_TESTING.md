# Quick Start: Integration Testing in 5 Minutes

**Goal:** Get integration tests running in under 5 minutes

---

## Prerequisites Checklist

- [ ] macOS (or Linux)
- [ ] Obsidian installed and running
- [ ] Local REST API plugin installed
- [ ] Your plugin installed and enabled
- [ ] `curl` available (pre-installed on macOS)

---

## Step 1: Get Your API Key (30 seconds)

```bash
# Find your vault path
VAULT_PATH="/Users/YOUR_USERNAME/Documents/obsidian-vault"

# Get API key
grep '"apiKey"' "$VAULT_PATH/.obsidian/plugins/obsidian-local-rest-api/data.json" | cut -d'"' -f4
```

**Copy the output** - that's your API key!

---

## Step 2: Test Basic Connectivity (30 seconds)

```bash
# Replace with your API key
API_KEY="your-api-key-here"

# Test connection
curl -k -s \
  -H "Authorization: Bearer $API_KEY" \
  "https://127.0.0.1:27124/" | python3 -m json.tool
```

**Expected:** JSON response with `"status": "OK"`

If you see this, you're ready! ✅

---

## Step 3: Create Your First Test (2 minutes)

Create file: `my-first-test.sh`

```bash
#!/bin/bash

# Configuration
API_KEY="paste-your-api-key-here"
BASE_URL="https://127.0.0.1:27124"

# Check if Obsidian is running
echo "Checking if Obsidian is running..."
if osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"' | grep -q true; then
    echo "✓ Obsidian is running"
else
    echo "✗ Obsidian is NOT running - please start it!"
    exit 1
fi

# Test API
echo "Testing API connection..."
HTTP_CODE=$(curl -k -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $API_KEY" \
    "$BASE_URL/")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ API is accessible (HTTP $HTTP_CODE)"
else
    echo "✗ API is NOT accessible (HTTP $HTTP_CODE)"
    exit 1
fi

# Check if your plugin is loaded
echo "Checking if your plugin is loaded..."
response=$(curl -k -s \
    -H "Authorization: Bearer $API_KEY" \
    "$BASE_URL/")

if echo "$response" | grep -q "your-plugin-id"; then
    echo "✓ Your plugin is loaded!"

    # Extract version
    if command -v jq &> /dev/null; then
        version=$(echo "$response" | jq -r '.apiExtensions[] | select(.id=="your-plugin-id") | .version')
        echo "  Version: $version"
    fi
else
    echo "⚠ Your plugin might not be registered with Local REST API"
fi

echo ""
echo "All basic tests passed! ✅"
```

---

## Step 4: Make It Executable (10 seconds)

```bash
chmod +x my-first-test.sh
```

---

## Step 5: Run It! (10 seconds)

```bash
./my-first-test.sh
```

**Expected output:**
```
Checking if Obsidian is running...
✓ Obsidian is running
Testing API connection...
✓ API is accessible (HTTP 200)
Checking if your plugin is loaded...
✓ Your plugin is loaded!
  Version: 1.0.0

All basic tests passed! ✅
```

---

## What Just Happened?

You just:
1. ✅ Detected if Obsidian is running (osascript)
2. ✅ Made an authenticated API call (curl)
3. ✅ Validated your plugin is loaded
4. ✅ Extracted plugin version from response

**This is integration testing!**

---

## Next Steps

### Add More Tests

```bash
# Test a custom endpoint
test_my_endpoint() {
    echo "Testing /my-endpoint..."

    response=$(curl -k -s -X POST \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"key":"value"}' \
        "$BASE_URL/my-endpoint")

    if echo "$response" | grep -q "success"; then
        echo "✓ /my-endpoint works"
    else
        echo "✗ /my-endpoint failed"
    fi
}
```

### Test File Operations

```bash
# Create a test file
test_file_creation() {
    echo "Testing file creation..."

    curl -k -s -X PUT \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: text/markdown" \
        -d "# Test\n\nContent" \
        "$BASE_URL/vault/test.md" > /dev/null

    if [ -f "$VAULT_PATH/test.md" ]; then
        echo "✓ File created"

        # Clean up
        curl -k -s -X DELETE \
            -H "Authorization: Bearer $API_KEY" \
            "$BASE_URL/vault/test.md" > /dev/null
    fi
}
```

### Make It Pretty

```bash
# Add colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}✓ Test passed${NC}"
echo -e "${RED}✗ Test failed${NC}"
```

---

## Common Issues

### "401 Unauthorized"
➜ Check your API key is correct

### "Connection refused"
➜ Check Obsidian is running
➜ Check Local REST API plugin is enabled

### "SSL certificate problem"
➜ Use `-k` flag with curl

### "osascript: command not found"
➜ You're not on macOS - use `pgrep obsidian` instead

---

## Full Template

Here's a complete template ready to use:

```bash
#!/bin/bash
set -e

# Configuration
VAULT_PATH="/path/to/your/vault"
API_CONFIG="$VAULT_PATH/.obsidian/plugins/obsidian-local-rest-api/data.json"

# Auto-extract API key
API_KEY=$(grep -o '"apiKey":"[^"]*' "$API_CONFIG" | cut -d'"' -f4)
PORT=$(grep -o '"port":[0-9]*' "$API_CONFIG" | cut -d':' -f2)
BASE_URL="https://127.0.0.1:${PORT}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Test counter
PASSED=0
FAILED=0

# Helper
test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASSED=$((PASSED + 1))
}

test_fail() {
    echo -e "${RED}✗${NC} $1"
    FAILED=$((FAILED + 1))
}

# Tests
echo "=== Running Integration Tests ==="
echo ""

# 1. Environment
if osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"' | grep -q true; then
    test_pass "Obsidian is running"
else
    test_fail "Obsidian is running"
    exit 1
fi

# 2. API
HTTP_CODE=$(curl -k -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $API_KEY" "$BASE_URL/")
if [ "$HTTP_CODE" = "200" ]; then
    test_pass "API is accessible"
else
    test_fail "API is accessible (HTTP $HTTP_CODE)"
fi

# 3. Your plugin
response=$(curl -k -s -H "Authorization: Bearer $API_KEY" "$BASE_URL/")
if echo "$response" | grep -q "your-plugin-id"; then
    test_pass "Your plugin is loaded"
else
    test_fail "Your plugin is loaded"
fi

# Add your tests here...

# Summary
echo ""
echo "Results: $PASSED passed, $FAILED failed"
[ $FAILED -eq 0 ] && echo "All tests passed! ✅" || echo "Some tests failed ✗"
```

---

## You're Done!

You now have:
- ✅ Working integration tests
- ✅ Automated verification of your plugin
- ✅ A template to extend

**Time to add this to your CI/CD pipeline!**

For more advanced usage, see [INTEGRATION_TESTING_GUIDE.md](./INTEGRATION_TESTING_GUIDE.md)
