<?php
/**
 * Tags API
 */
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/_headers.php';
require_once __DIR__ . '/_csrf.php';
require_once __DIR__ . '/../config/database.php';

$pdo = (new Database())->getConnection();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Get all tags with snippet count
        $sql = "SELECT t.name, COUNT(st.snippet_id) as count FROM tags t LEFT JOIN snippet_tags st ON t.id = st.tag_id GROUP BY t.id ORDER BY t.name ASC";
        $stmt = $pdo->query($sql);
        $tags = $stmt->fetchAll();
        echo json_encode(['success' => true, 'data' => $tags]);
        break;

    case 'POST':
        // Create new tag(s)
        if (!csrf_validate()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'CSRF validation failed']);
            break;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['tags']) || !is_array($input['tags'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Tags array required']);
            break;
        }

        $created = [];
        foreach ($input['tags'] as $tagName) {
            // Normalize to lowercase + trim
            $name = strtolower(trim($tagName));
            if (empty($name)) continue;
            if (strlen($name) > 100) continue;

            try {
                $stmt = $pdo->prepare("INSERT IGNORE INTO tags (name) VALUES (:name)");
                $stmt->execute([':name' => $name]);
                $id = $pdo->lastInsertId();
                if ($id) $created[] = $name;
            } catch (PDOException $e) {
                error_log('Create tag error: ' . $e->getMessage());
            }
        }

        echo json_encode(['success' => true, 'data' => ['tags' => $created]]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}