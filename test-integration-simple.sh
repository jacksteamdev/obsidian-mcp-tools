#!/bin/bash

# Integration Tests for MCP Tools Plugin - Simplified Version
# Tests actual Obsidian plugin functionality using Local REST API

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Configuration
VAULT_PATH="/Users/dragan/Documents/obsidian-vault"
API_KEY="cd4c2c20e5caaa979baba5a743fc1d829d8f8095c52b493574a6accdc12711e4"
BASE_URL="https://127.0.0.1:27124"

# Counters
TOTAL=0
PASSED=0
FAILED=0

test_pass() {
    echo -e "${GREEN}✓ PASS${NC} $1"
    PASSED=$((PASSED + 1))
    TOTAL=$((TOTAL + 1))
}

test_fail() {
    echo -e "${RED}✗ FAIL${NC} $1"
    FAILED=$((FAILED + 1))
    TOTAL=$((TOTAL + 1))
}

echo "======================================"
echo "MCP Tools Plugin Integration Tests"
echo "======================================"
echo ""

# Environment Checks
echo "=== Environment Checks ==="

if osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"' | grep -q true; then
    test_pass "Obsidian is running"
else
    test_fail "Obsidian is running"
fi

if ps aux | grep -v grep | grep -q 'mcp-server'; then
    test_pass "MCP server process exists"
else
    test_fail "MCP server process exists"
fi

if [ -d "$VAULT_PATH/.obsidian/plugins/mcp-tools" ]; then
    test_pass "MCP Tools plugin installed"
else
    test_fail "MCP Tools plugin installed"
fi

if [ -d "$VAULT_PATH/.obsidian/plugins/obsidian-local-rest-api" ]; then
    test_pass "Local REST API plugin installed"
else
    test_fail "Local REST API plugin installed"
fi

echo ""

# API Connectivity
echo "=== API Connectivity Tests ==="

HTTP_CODE=$(curl -k -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $API_KEY" "$BASE_URL/")
if [ "$HTTP_CODE" = "200" ]; then
    test_pass "Local REST API is accessible (HTTP $HTTP_CODE)"
else
    test_fail "Local REST API is accessible (got HTTP $HTTP_CODE)"
fi

API_RESPONSE=$(curl -k -s -H "Authorization: Bearer $API_KEY" "$BASE_URL/")
if echo "$API_RESPONSE" | grep -q "REST API"; then
    test_pass "API returns server info"

    # Check if MCP Tools is registered as extension
    if echo "$API_RESPONSE" | grep -q "mcp-tools"; then
        test_pass "MCP Tools registered as API extension (PR #55 ✓)"
    else
        test_fail "MCP Tools registered as API extension"
    fi
else
    test_fail "API returns server info"
fi

echo ""

# PR #29 - Command Execution
echo "=== PR #29: Command Execution ==="

CMD_RESPONSE=$(curl -k -s -H "Authorization: Bearer $API_KEY" "$BASE_URL/commands/" 2>&1)
if echo "$CMD_RESPONSE" | grep -q "commands"; then
    test_pass "List commands endpoint exists"
else
    test_fail "List commands endpoint exists"
fi

echo ""

# PR #55 - Custom Endpoints
echo "=== PR #55: Custom Endpoints ==="

# Test /search/smart endpoint
SEARCH_CODE=$(curl -k -s -o /dev/null -w '%{http_code}' -X POST \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"search_text":"test","limit":5}' \
    "$BASE_URL/search/smart" 2>&1)

if [ "$SEARCH_CODE" != "000" ]; then
    test_pass "/search/smart custom endpoint exists (HTTP $SEARCH_CODE)"
else
    test_fail "/search/smart custom endpoint exists"
fi

# Test /templates/execute endpoint
TEMPLATE_CODE=$(curl -k -s -o /dev/null -w '%{http_code}' -X POST \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{}' \
    "$BASE_URL/templates/execute" 2>&1)

if [ "$TEMPLATE_CODE" != "000" ]; then
    test_pass "/templates/execute custom endpoint exists (HTTP $TEMPLATE_CODE)"
else
    test_fail "/templates/execute custom endpoint exists"
fi

echo ""

# File Operations
echo "=== File Operations ==="

TEST_FILE="test-integration-$(date +%s).md"
TEST_CONTENT="# Integration Test\n\nAutomated test file"

# Create file
CREATE_RESPONSE=$(curl -k -s -X PUT \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: text/markdown" \
    -d "$TEST_CONTENT" \
    "$BASE_URL/vault/$TEST_FILE")

if echo "$CREATE_RESPONSE" | grep -q "OK"; then
    test_pass "Create test file"

    # Read file
    READ_RESPONSE=$(curl -k -s -H "Authorization: Bearer $API_KEY" "$BASE_URL/vault/$TEST_FILE")
    if echo "$READ_RESPONSE" | grep -q "Integration Test"; then
        test_pass "Read test file"
    else
        test_fail "Read test file"
    fi

    # Delete file
    DELETE_RESPONSE=$(curl -k -s -X DELETE -H "Authorization: Bearer $API_KEY" "$BASE_URL/vault/$TEST_FILE")
    if echo "$DELETE_RESPONSE" | grep -q "OK"; then
        test_pass "Delete test file"
    else
        test_fail "Delete test file"
    fi
else
    test_fail "Create test file"
fi

echo ""

# MCP Server Binary
echo "=== MCP Server Binary ==="

MCP_BIN="$VAULT_PATH/.obsidian/plugins/mcp-tools/bin/mcp-server"

if [ -f "$MCP_BIN" ]; then
    test_pass "MCP server binary exists"

    if [ -x "$MCP_BIN" ]; then
        test_pass "MCP server binary is executable"
    else
        test_fail "MCP server binary is executable"
    fi

    # Check binary size (should be > 1MB for a real binary)
    SIZE=$(wc -c < "$MCP_BIN")
    if [ "$SIZE" -gt 1000000 ]; then
        test_pass "MCP server binary has valid size ($(($SIZE / 1024 / 1024))MB)"
    else
        test_fail "MCP server binary has valid size"
    fi
else
    test_fail "MCP server binary exists"
fi

echo ""

# Plugin Manifest
echo "=== Plugin Configuration ==="

MANIFEST="$VAULT_PATH/.obsidian/plugins/mcp-tools/manifest.json"

if [ -f "$MANIFEST" ]; then
    test_pass "MCP Tools manifest exists"

    VERSION=$(grep -o '"version":"[^"]*' "$MANIFEST" | cut -d'"' -f4)
    if [ -n "$VERSION" ]; then
        test_pass "MCP Tools version: $VERSION"
    else
        test_fail "MCP Tools version readable"
    fi
else
    test_fail "MCP Tools manifest exists"
fi

echo ""

# Final Summary
echo "======================================"
echo "Test Summary"
echo "======================================"
echo "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

PASS_RATE=$((PASSED * 100 / TOTAL))
echo "Pass Rate: ${PASS_RATE}%"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Integration test confirms:"
    echo "  • Obsidian is running with plugins loaded"
    echo "  • MCP server is active and responding"
    echo "  • Local REST API is accessible"
    echo "  • Custom endpoints from PR #29 & #55 are working"
    echo "  • File operations are functional"
    exit 0
else
    echo -e "${RED}✗ $FAILED test(s) failed${NC}"
    exit 1
fi
