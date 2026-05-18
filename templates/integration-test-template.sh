#!/bin/bash
################################################################################
# Integration Test Template for Obsidian Plugins
#
# Description: Template for creating integration tests using osascript + curl
# Author: Claude Code
# Date: 2025-11-15
#
# Usage:
#   1. Copy this template to your project
#   2. Update the configuration section
#   3. Add your custom tests
#   4. Make executable: chmod +x test-integration.sh
#   5. Run: ./test-integration.sh
################################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

################################################################################
# CONFIGURATION - UPDATE THESE VALUES
################################################################################

# Path to your Obsidian vault
VAULT_PATH="/path/to/your/vault"

# Your plugin ID (from manifest.json)
PLUGIN_ID="your-plugin-id"

# Local REST API config file
API_CONFIG="$VAULT_PATH/.obsidian/plugins/obsidian-local-rest-api/data.json"

################################################################################
# AUTO-CONFIGURATION (no need to change)
################################################################################

# Extract API key and port from config
API_KEY=$(grep -o '"apiKey":"[^"]*' "$API_CONFIG" | cut -d'"' -f4)
PORT=$(grep -o '"port":[0-9]*' "$API_CONFIG" | cut -d':' -f2)
BASE_URL="https://127.0.0.1:${PORT}"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Test counters
TOTAL=0
PASSED=0
FAILED=0
SKIPPED=0

################################################################################
# HELPER FUNCTIONS
################################################################################

# Print colored output
print_header() {
    echo ""
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Test result functions
test_pass() {
    print_success "$1"
    PASSED=$((PASSED + 1))
    TOTAL=$((TOTAL + 1))
}

test_fail() {
    print_error "$1"
    FAILED=$((FAILED + 1))
    TOTAL=$((TOTAL + 1))
}

test_skip() {
    print_warning "$1 (SKIPPED)"
    SKIPPED=$((SKIPPED + 1))
    TOTAL=$((TOTAL + 1))
}

# API request wrapper
api_get() {
    local endpoint="$1"
    curl -k -s \
        -H "Authorization: Bearer $API_KEY" \
        "$BASE_URL$endpoint"
}

api_post() {
    local endpoint="$1"
    local data="$2"
    curl -k -s -X POST \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d "$data" \
        "$BASE_URL$endpoint"
}

api_put() {
    local endpoint="$1"
    local data="$2"
    local content_type="${3:-text/markdown}"
    curl -k -s -X PUT \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: $content_type" \
        -d "$data" \
        "$BASE_URL$endpoint"
}

api_delete() {
    local endpoint="$1"
    curl -k -s -X DELETE \
        -H "Authorization: Bearer $API_KEY" \
        "$BASE_URL$endpoint"
}

# Get HTTP status code
api_status() {
    local endpoint="$1"
    curl -k -s -o /dev/null -w '%{http_code}' \
        -H "Authorization: Bearer $API_KEY" \
        "$BASE_URL$endpoint"
}

################################################################################
# PREREQUISITE CHECKS
################################################################################

check_prerequisites() {
    print_header "Checking Prerequisites"

    local prereq_failed=0

    # Check if curl is installed
    if command -v curl &> /dev/null; then
        print_success "curl is installed"
    else
        print_error "curl is not installed"
        prereq_failed=1
    fi

    # Check if jq is installed (optional but recommended)
    if command -v jq &> /dev/null; then
        print_success "jq is installed"
    else
        print_warning "jq is not installed (optional)"
    fi

    # Check if Obsidian is running
    if osascript -e 'tell application "System Events" to (name of processes) contains "Obsidian"' | grep -q true 2>/dev/null; then
        print_success "Obsidian is running"
    else
        print_error "Obsidian is not running - please start Obsidian!"
        prereq_failed=1
    fi

    # Check if vault exists
    if [ -d "$VAULT_PATH" ]; then
        print_success "Vault found at $VAULT_PATH"
    else
        print_error "Vault not found at $VAULT_PATH"
        prereq_failed=1
    fi

    # Check if API config exists
    if [ -f "$API_CONFIG" ]; then
        print_success "API config found"
    else
        print_error "API config not found at $API_CONFIG"
        prereq_failed=1
    fi

    # Check if plugin is installed
    if [ -d "$VAULT_PATH/.obsidian/plugins/$PLUGIN_ID" ]; then
        print_success "Plugin '$PLUGIN_ID' is installed"
    else
        print_error "Plugin '$PLUGIN_ID' is not installed"
        prereq_failed=1
    fi

    if [ $prereq_failed -eq 1 ]; then
        echo ""
        print_error "Prerequisites check failed. Please fix the issues above."
        exit 1
    fi
}

################################################################################
# TEST SUITES
################################################################################

test_environment() {
    print_header "Environment Tests"

    # Test: Obsidian process exists
    if ps aux | grep -v grep | grep -q Obsidian; then
        test_pass "Obsidian process is running"
    else
        test_fail "Obsidian process is running"
    fi

    # Test: Plugin directory exists
    if [ -d "$VAULT_PATH/.obsidian/plugins/$PLUGIN_ID" ]; then
        test_pass "Plugin directory exists"
    else
        test_fail "Plugin directory exists"
    fi

    # Test: Plugin manifest exists
    if [ -f "$VAULT_PATH/.obsidian/plugins/$PLUGIN_ID/manifest.json" ]; then
        test_pass "Plugin manifest exists"

        # Extract version
        if command -v jq &> /dev/null; then
            version=$(jq -r '.version' "$VAULT_PATH/.obsidian/plugins/$PLUGIN_ID/manifest.json")
            print_info "Plugin version: $version"
        fi
    else
        test_fail "Plugin manifest exists"
    fi
}

test_api_connectivity() {
    print_header "API Connectivity Tests"

    # Test: API is accessible
    local http_code=$(api_status "/")
    if [ "$http_code" = "200" ]; then
        test_pass "Local REST API is accessible (HTTP $http_code)"
    else
        test_fail "Local REST API is accessible (got HTTP $http_code)"
        return
    fi

    # Test: Authentication works
    local response=$(api_get "/")
    if echo "$response" | grep -q '"authenticated":true'; then
        test_pass "API authentication successful"
    else
        test_fail "API authentication successful"
    fi

    # Test: Get API version
    if command -v jq &> /dev/null; then
        local api_version=$(echo "$response" | jq -r '.versions.self')
        if [ -n "$api_version" ] && [ "$api_version" != "null" ]; then
            test_pass "API version retrieved: $api_version"
        else
            test_fail "API version retrieved"
        fi
    fi
}

test_plugin_registration() {
    print_header "Plugin Registration Tests"

    # Test: Plugin is registered with API
    local response=$(api_get "/")

    if echo "$response" | grep -q "\"$PLUGIN_ID\""; then
        test_pass "Plugin is registered with Local REST API"

        # Extract plugin info
        if command -v jq &> /dev/null; then
            local plugin_info=$(echo "$response" | jq ".apiExtensions[] | select(.id==\"$PLUGIN_ID\")")
            if [ -n "$plugin_info" ]; then
                local plugin_name=$(echo "$plugin_info" | jq -r '.name')
                local plugin_version=$(echo "$plugin_info" | jq -r '.version')
                print_info "Plugin name: $plugin_name"
                print_info "Plugin version: $plugin_version"
            fi
        fi
    else
        test_fail "Plugin is registered with Local REST API"
    fi
}

test_custom_endpoints() {
    print_header "Custom Endpoints Tests"

    # ADD YOUR CUSTOM ENDPOINT TESTS HERE

    # Example: Test a GET endpoint
    # local response=$(api_get "/your-endpoint")
    # if echo "$response" | grep -q "expected-value"; then
    #     test_pass "GET /your-endpoint works"
    # else
    #     test_fail "GET /your-endpoint works"
    # fi

    # Example: Test a POST endpoint
    # local response=$(api_post "/your-endpoint" '{"key":"value"}')
    # local http_code=$(curl -k -s -o /dev/null -w '%{http_code}' \
    #     -X POST \
    #     -H "Authorization: Bearer $API_KEY" \
    #     -H "Content-Type: application/json" \
    #     -d '{"key":"value"}' \
    #     "$BASE_URL/your-endpoint")
    # if [ "$http_code" = "200" ]; then
    #     test_pass "POST /your-endpoint works (HTTP $http_code)"
    # else
    #     test_fail "POST /your-endpoint works (HTTP $http_code)"
    # fi

    print_warning "No custom endpoint tests defined yet"
    test_skip "Custom endpoint tests"
}

test_file_operations() {
    print_header "File Operations Tests"

    local test_file="test-integration-$(date +%s).md"
    local test_content="# Integration Test\n\nThis is a test file created by automated tests."

    # Test: Create file
    local create_response=$(api_put "/vault/$test_file" "$test_content")
    if [ -f "$VAULT_PATH/$test_file" ]; then
        test_pass "Create test file"

        # Test: Read file
        local read_response=$(api_get "/vault/$test_file")
        if echo "$read_response" | grep -q "Integration Test"; then
            test_pass "Read test file"
        else
            test_fail "Read test file"
        fi

        # Test: Delete file
        local delete_response=$(api_delete "/vault/$test_file")
        sleep 0.5  # Give filesystem time to sync

        if [ ! -f "$VAULT_PATH/$test_file" ]; then
            test_pass "Delete test file"
        else
            test_fail "Delete test file"
            # Clean up manually
            rm -f "$VAULT_PATH/$test_file"
        fi
    else
        test_fail "Create test file"
    fi
}

test_error_handling() {
    print_header "Error Handling Tests"

    # Test: 404 for non-existent file
    local http_code=$(api_status "/vault/non-existent-file.md")
    if [ "$http_code" = "404" ]; then
        test_pass "Returns 404 for non-existent file"
    else
        test_fail "Returns 404 for non-existent file (got HTTP $http_code)"
    fi

    # Test: 401 for invalid API key
    local http_code=$(curl -k -s -o /dev/null -w '%{http_code}' \
        -H "Authorization: Bearer invalid-key" \
        "$BASE_URL/")
    if [ "$http_code" = "401" ]; then
        test_pass "Returns 401 for invalid API key"
    else
        test_fail "Returns 401 for invalid API key (got HTTP $http_code)"
    fi
}

################################################################################
# CLEANUP
################################################################################

cleanup() {
    print_header "Cleanup"

    # Remove any test files that might be left over
    for file in "$VAULT_PATH"/test-integration-*.md; do
        if [ -f "$file" ]; then
            rm -f "$file"
            print_info "Removed test file: $(basename "$file")"
        fi
    done

    print_success "Cleanup complete"
}

################################################################################
# REPORTING
################################################################################

generate_summary() {
    echo ""
    echo "======================================"
    echo "Test Summary"
    echo "======================================"
    echo "Total Tests:   $TOTAL"
    echo -e "Passed:        ${GREEN}$PASSED${NC}"
    echo -e "Failed:        ${RED}$FAILED${NC}"
    echo -e "Skipped:       ${YELLOW}$SKIPPED${NC}"

    if [ $TOTAL -gt 0 ]; then
        local pass_rate=$((PASSED * 100 / TOTAL))
        echo "Pass Rate:     ${pass_rate}%"
    fi

    echo ""

    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        echo ""
        echo "Integration tests confirm:"
        echo "  • Obsidian is running with plugins loaded"
        echo "  • Local REST API is accessible"
        echo "  • Your plugin is functional"
        return 0
    else
        echo -e "${RED}✗ $FAILED test(s) failed${NC}"
        echo ""
        echo "Please review the failures above and fix them."
        return 1
    fi
}

################################################################################
# MAIN
################################################################################

main() {
    echo "======================================"
    echo "Integration Tests for $PLUGIN_ID"
    echo "======================================"
    echo "Date: $(date)"
    echo ""

    # Run prerequisite checks
    check_prerequisites

    # Run test suites
    test_environment
    test_api_connectivity
    test_plugin_registration
    test_custom_endpoints
    test_file_operations
    test_error_handling

    # Cleanup
    cleanup

    # Generate summary and exit with appropriate code
    generate_summary
    exit $?
}

# Register cleanup on script exit
trap cleanup EXIT

# Run main function
main "$@"
