<?php
/**
 * CSRF Protection helper
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Get the raw POST body content (reads php://input once and caches it)
 */
function get_raw_body(): string {
    static $rawBody = null;
    if ($rawBody === null) {
        $rawBody = file_get_contents('php://input');
    }
    return $rawBody ?: '';
}

/**
 * Generate and return a CSRF token for the current session.
 * If none exists, creates one on first call.
 */
function csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Validate the CSRF token from request.
 * Checks in priority order:
 * 1. POST param (for form submissions)
 * 2. X-CSRF-Token header (for AJAX JSON requests)
 * 3. GET param (legacy/fallback)
 */
function csrf_validate(): bool {
    $token = '';

    // Priority 1: POST param
    if (!empty($_POST['csrf_token'])) {
        $token = $_POST['csrf_token'];
    }
    // Priority 2: X-CSRF-Token header (AJAX)
    elseif (isset($_SERVER['HTTP_X_CSRF_TOKEN']) && !empty($_SERVER['HTTP_X_CSRF_TOKEN'])) {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'];
    }
    // Priority 3: GET param (fallback)
    elseif (!empty($_GET['csrf_token'])) {
        $token = $_GET['csrf_token'];
    }

    if (!$token) return false;

    // Use hash_equals for timing-safe comparison
    return hash_equals(csrf_token(), $token);
}