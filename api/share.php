<?php
/**
 * Public Share Endpoint - View shared snippets without authentication
 */
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/_headers.php';
require_once __DIR__ . '/../config/database.php';

$pdo = (new Database())->getConnection();

// GET /api/share.php?share_token={token} - Get shared snippet by token
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $token = trim($_GET['share_token'] ?? '');

    if (!$token) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'share_token is required']);
        exit;
    }

    // Fetch public snippet by token
    $stmt = $pdo->prepare("SELECT id, title, code, language, description, share_token, is_public, created_at, updated_at FROM snippets WHERE share_token = :token AND is_public = 1");
    $stmt->execute([':token' => $token]);
    $snippet = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$snippet) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Shared snippet not found or has been revoked']);
        exit;
    }

    // Get tags for this snippet
    $tagStmt = $pdo->prepare("
        SELECT t.name FROM tags t
        INNER JOIN snippet_tags st ON t.id = st.tag_id
        WHERE st.snippet_id = :snippet_id
    ");
    $tagStmt->execute([':snippet_id' => $snippet['id']]);
    $tags = array_column($tagStmt->fetchAll(), 'name');

    echo json_encode([
        'success' => true,
        'data' => [
            'id' => $snippet['id'],
            'title' => $snippet['title'],
            'code' => $snippet['code'],
            'language' => $snippet['language'],
            'description' => $snippet['description'],
            'tags' => $tags,
            'share_token' => $snippet['share_token'],
            'created_at' => $snippet['created_at'],
            'updated_at' => $snippet['updated_at']
        ]
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);