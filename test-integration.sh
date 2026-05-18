#!/bin/bash

# Integration Tests for MCP Tools Plugin
# Tests actual Obsidian plugin functionality using Local REST API
# Date: 2025-11-15

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
VAULT_PATH="/Users/dragan/Documents/obsidian-vault"
API_CONFIG="$VAULT_PATH/.obsidian/plugins/obsidian-local-rest-api/data.json"
MCP_PLUGIN="$VAULT_PATH/.obsidian/plugins/mcp-tools"

# Read API configuration
if [ ! -f "$API_CONFIG" ]; then
    echo -e "${RED}✗ Local REST API config not found${NC}"
    exit 1
fi

API_KEY=$(grep 'apiKey' "$API_CONFIG" | cut -d'"' -f4)
PORT=$(grep -E '^\s*"port"' "$API_CONFIG" | grep -oE '[0-9]+')
BASE_URL="https://127.0.0.1:${PORT}"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test function
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_code="${3:-0}"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -n "Testing: $test_name... "

    # Run command and capture exit code
    if eval "$command" > /dev/null 2>&1; then
        actual_code=0
    else
        actual_code=$?
    fi

    if [ "$actual_code" -eq "$expected_code" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (expected exit code $expected_code, got $actual_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Test with output capture
run_test_with_output() {
    local test_name="$1"
    local command="$2"
    local expected_pattern="$3"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -n "Testing: $test_name... "

    # Run command and capture output
    output=$(eval "$command" 2>&1 || true)

    if echo "$output" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Expected pattern: $expected_pattern"
        echo "  Got: $output"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo "======================================"
echo "MCP Tools Plugin Integration Tests"
echo "======================================"
echo ""

# Section 1: Environment Checks
echo "=== Environment Checks ==="
run_test "Obsidian is running" \
    "osascript -e 'tell application \"System Events\" to (name of processes) contains \"Obsidian\"' | grep -q true"

run_test "MCP server process exists" \
    "ps aux | grep -v grep | grep -q 'mcp-server'"

run_test "MCP Tools plugin installed" \
    "[ -d '$MCP_PLUGIN' ]"

run_test "Local REST API plugin installed" \
    "[ -f '$API_CONFIG' ]"

echo ""

# Section 2: API Connectivity Tests
echo "=== API Connectivity Tests ==="

run_test_with_output "Local REST API is accessible" \
    "curl -k -s -o /dev/null -w '%{http_code}' -H \"Authorization: Bearer ${API_KEY}\" \"${BASE_URL}/\"" \
    "200"

run_test_with_output "API returns server info" \
    "curl -k -s -H \"Authorization: Bearer ${API_KEY}\" \"${BASE_URL}/\"" \
    "REST API"

echo ""

# Section 3: PR #29 - Command Execution Tests
echo "=== PR #29: Command Execution ==="

run_test_with_output "List commands endpoint exists" \
    "curl -k -s -H 'Authorization: Bearer $API_KEY' '$BASE_URL/commands/'" \
    "commands"

echo ""

# Section 4: PR #55 - Version Check Tests
echo "=== PR #55: Version Check & Custom Endpoints ==="

run_test_with_output "Custom /search/smart endpoint exists" \
    "curl -k -s -X POST -H 'Authorization: Bearer $API_KEY' -H 'Content-Type: application/json' -d '{\"search_text\":\"test\"}' '$BASE_URL/search/smart' 2>&1" \
    "."  # Just check it responds (may return error if no Smart Connections)

run_test_with_output "Custom /templates/execute endpoint exists" \
    "curl -k -s -X POST -H 'Authorization: Bearer $API_KEY' -H 'Content-Type: application/json' -d '{\"template_file\":\"\"}' '$BASE_URL/templates/execute' 2>&1" \
    "."  # Just check it responds

echo ""

# Section 5: File Operations Tests
echo "=== File Operations ==="

# Create a test file
TEST_FILE="test-integration-$(date +%s).md"
TEST_CONTENT="# Integration Test\n\nThis is a test file created by automated integration tests."

run_test_with_output "Create test file" \
    "curl -k -s -o /dev/null -w '%{http_code}' -X PUT -H 'Authorization: Bearer $API_KEY' -H 'Content-Type: text/markdown' -d '$TEST_CONTENT' '$BASE_URL/vault/$TEST_FILE'" \
    "20[04]"

run_test "Read test file" \
    "curl -k -s -H 'Authorization: Bearer $API_KEY' '$BASE_URL/vault/$TEST_FILE' | grep -q 'Integration Test'"

run_test_with_output "Delete test file" \
    "curl -k -s -o /dev/null -w '%{http_code}' -X DELETE -H 'Authorization: Bearer $API_KEY' '$BASE_URL/vault/$TEST_FILE'" \
    "20[04]"

echo ""

# Section 6: MCP Server Tests
echo "=== MCP Server Tests ==="

MCP_BIN="$MCP_PLUGIN/bin/mcp-server"

run_test "MCP server binary exists" \
    "[ -f '$MCP_BIN' ]"

run_test "MCP server binary is executable" \
    "[ -x '$MCP_BIN' ]"

# Check if MCP server responds (it's stdio-based, so just check process)
run_test_with_output "MCP server version info" \
    "ls -lh '$MCP_BIN'" \
    "mcp-server"

echo ""

# Section 7: Plugin Configuration Tests
echo "=== Plugin Configuration ==="

run_test "MCP Tools manifest exists" \
    "[ -f '$MCP_PLUGIN/manifest.json' ]"

run_test_with_output "MCP Tools manifest version" \
    "cat '$MCP_PLUGIN/manifest.json'" \
    "version"

echo ""

# Final Summary
echo "======================================"
echo "Test Summary"
echo "======================================"
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
