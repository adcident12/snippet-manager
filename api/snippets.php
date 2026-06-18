<?php
/**
 * Snippets API - CRUD operations
 */
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/_headers.php';
require_once __DIR__ . '/_csrf.php';
require_once __DIR__ . '/../config/database.php';

// Ensure session is started for CSRF validation
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Get PDO connection
$pdo = (new Database())->getConnection();

// Check for CSRF token endpoint
if (isset($_GET['_csrf']) && $_GET['_csrf'] === '1') {
    // Ensure session is started and generate token
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    csrf_token();
    echo json_encode(['success' => true, 'csrf_token' => csrf_token()]);
    exit;
}

// Route by method
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Don't handle _csrf in handleGet — it's handled above
        if (isset($_GET['_csrf'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => '_csrf endpoint does not accept GET params']);
            exit;
        }
        handleGet($pdo);
        break;
    case 'POST':
        handleCreate($pdo);
        break;
    case 'PUT':
        // Check for share/unshare action
        $action = trim($_GET['action'] ?? '');
        if ($action === 'share') {
            handleShare($pdo);
        } elseif ($action === 'unshare') {
            handleUnshare($pdo);
        } else {
            handleUpdate($pdo);
        }
        break;
    case 'DELETE':
        handleDelete($pdo);
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}

/**
 * List snippets or get single by ID
 */
function handleGet(PDO $pdo): void {
    // If id parameter provided, return single snippet
    $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
    if ($id) {
        $stmt = $pdo->prepare("SELECT * FROM snippets WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $snippet = $stmt->fetch();

        if (!$snippet) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Snippet not found']);
            return;
        }

        // Get tags for this snippet
        $tagStmt = $pdo->prepare("
            SELECT t.name FROM tags t
            INNER JOIN snippet_tags st ON t.id = st.tag_id
            WHERE st.snippet_id = :snippet_id
        ");
        $tagStmt->execute([':snippet_id' => $id]);
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
                'is_public' => (bool) $snippet['is_public'],
                'created_at' => $snippet['created_at'],
                'updated_at' => $snippet['updated_at']
            ]
        ]);
        return;
    }

    // List all snippets with optional filters
    $limit = filter_input(INPUT_GET, 'limit', FILTER_VALIDATE_INT) ?: 50;
    if ($limit > 200) $limit = 200;
    if ($limit < 1) $limit = 50;

    $offset = filter_input(INPUT_GET, 'offset', FILTER_VALIDATE_INT) ?: 0;
    if ($offset < 0) $offset = 0;

    $tagFilter = trim($_GET['tag'] ?? '');
    $search = trim($_GET['q'] ?? '');

    // Build query
    $whereClauses = [];
    $params = [];

    if ($tagFilter) {
        $whereClauses[] = "EXISTS (SELECT 1 FROM snippet_tags st2 INNER JOIN tags t2 ON st2.tag_id = t2.id WHERE st2.snippet_id = s.id AND t2.name = :tag_filter)";
        $params[':tag_filter'] = $tagFilter;
    }

    if ($search) {
        // Escape MySQL full-text search special chars and boolean operators
        $ftSearch = preg_replace('/\b(OR|AND NOT|AND|NOT)\b/i', ' + ', $search);
        // Escape LIKE wildcard characters (separate from FT)
        $searchEscaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $ftSearch);
        $whereClauses[] = "(MATCH(s.title, s.code, s.description) AGAINST(:search IN NATURAL LANGUAGE MODE) OR s.title LIKE :search_like)";
        $params[':search'] = $ftSearch;
        $params[':search_like'] = '%' . $searchEscaped . '%';
    }

    $whereSql = '';
    if ($whereClauses) {
        $whereSql = 'WHERE ' . implode(' AND ', $whereClauses);
    }

    // Count total matching snippets
    $countSql = "SELECT COUNT(DISTINCT s.id) FROM snippets s LEFT JOIN snippet_tags st ON s.id = st.snippet_id LEFT JOIN tags t ON st.tag_id = t.id {$whereSql}";
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $key => $value) {
        $countStmt->bindValue($key, $value, is_string($value) ? PDO::PARAM_STR : PDO::PARAM_INT);
    }
    $countStmt->execute();
    $total = (int) $countStmt->fetchColumn();

    // Get snippets with tags
    $sql = "SELECT s.*, GROUP_CONCAT(t.name ORDER BY t.name SEPARATOR ',') as tag_names FROM snippets s LEFT JOIN snippet_tags st ON s.id = st.snippet_id LEFT JOIN tags t ON st.tag_id = t.id {$whereSql} GROUP BY s.id ORDER BY s.updated_at DESC LIMIT :limit OFFSET :offset";

    $stmt = $pdo->prepare($sql);
    foreach ($params as $key => $value) {
        if (is_string($value)) {
            $stmt->bindValue($key, $value, PDO::PARAM_STR);
        } else {
            $stmt->bindValue($key, $value, PDO::PARAM_INT);
        }
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $snippets = $stmt->fetchAll();

    // Parse tags for each snippet
    foreach ($snippets as &$snippet) {
        $snippet['tags'] = $snippet['tag_names'] ? explode(',', $snippet['tag_names']) : [];
        unset($snippet['tag_names']);
    }
    unset($snippet);

    echo json_encode([
        'success' => true,
        'data' => $snippets,
        'meta' => [
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset
        ]
    ]);
}

/**
 * Create a new snippet
 */
function handleCreate(PDO $pdo): void {
    // CSRF validation for POST
    if (!csrf_validate()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'CSRF validation failed']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || empty($input['title'] ?? '')) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Title is required']);
        return;
    }

    $title = trim($input['title']);
    // Validate title length
    if (strlen($title) > 255) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Title must be 255 characters or less']);
        return;
    }

    // Sanitize code to remove dangerous null bytes/control chars only (preserve formatting)
    $code = '';
    if ($input['code'] !== null) {
        $code = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $input['code']);
        if ($code === null) $code = '';
    }
    // Validate code length (max 1MB)
    if (strlen($code) > 1048576) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Code must be 1MB or less']);
        return;
    }

    $language  = trim($input['language'] ?? 'plaintext');
    // Validate language (whitelist)
    $validLanguages = ['php', 'javascript', 'typescript', 'python', 'css', 'html', 'sql', 'json', 'bash', 'shell', 'java', 'cpp', 'csharp', 'go', 'rust', 'markdown', 'plaintext'];
    if (!in_array(strtolower($language), $validLanguages)) {
        $language = 'plaintext';
    }

    $description = isset($input['description']) ? trim($input['description']) : null;
    if ($description !== null && strlen($description) > 2048) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Description must be 2048 characters or less']);
        return;
    }

    try {
        $pdo->beginTransaction();

        // Insert snippet
        $stmt = $pdo->prepare("INSERT INTO snippets (title, code, language, description) VALUES (:title, :code, :language, :description)");
        $stmt->execute([
            ':title' => $title,
            ':code' => $code,
            ':language' => $language,
            ':description' => $description
        ]);
        $snippetId = $pdo->lastInsertId();

        // Handle tags (lowercase)
        if (!empty($input['tags']) && is_array($input['tags'])) {
            foreach ($input['tags'] as $tagName) {
                $tagName = strtolower(trim($tagName));
                if (empty($tagName)) continue;
                // Validate tag length
                if (strlen($tagName) > 100) continue;

                // Insert or get tag id
                $tagStmt = $pdo->prepare("INSERT IGNORE INTO tags (name) VALUES (:name)");
                $tagStmt->execute([':name' => $tagName]);
                $tagId = $pdo->lastInsertId();

                if (!$tagId) {
                    // Tag already exists, get it
                    $tagStmt = $pdo->prepare("SELECT id FROM tags WHERE name = :name");
                    $tagStmt->execute([':name' => $tagName]);
                    $tagId = $tagStmt->fetchColumn();
                }

                // Link snippet and tag
                $linkStmt = $pdo->prepare("INSERT IGNORE INTO snippet_tags (snippet_id, tag_id) VALUES (:sid, :tid)");
                $linkStmt->execute([':sid' => $snippetId, ':tid' => $tagId]);
            }
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Snippet created successfully',
            'data' => ['id' => $snippetId]
        ]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log('Create snippet error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create snippet']);
    }
}

/**
 * Update an existing snippet
 */
function handleUpdate(PDO $pdo): void {
    // CSRF validation for PUT
    if (!csrf_validate()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'CSRF validation failed']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);

    $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID is required']);
        return;
    }

    // Verify snippet exists and belongs to current session (prevent access others)
    $checkStmt = $pdo->prepare("SELECT id FROM snippets WHERE id = :id");
    $checkStmt->execute([':id' => $id]);
    if (!$checkStmt->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Snippet not found']);
        return;
    }

    if (!empty($input['title'] ?? '')) {
        $title = trim($input['title']);
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Title is required']);
        return;
    }

    // Validate title length
    if (strlen($title) > 255) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Title must be 255 characters or less']);
        return;
    }

    $language  = !empty($input['language']) ? trim($input['language']) : 'plaintext';
    // Validate language (whitelist)
    $validLanguages = ['php', 'javascript', 'typescript', 'python', 'css', 'html', 'sql', 'json', 'bash', 'shell', 'java', 'cpp', 'csharp', 'go', 'rust', 'markdown', 'plaintext'];
    if (!in_array(strtolower($language), $validLanguages)) {
        $language = 'plaintext';
    }

    $description = isset($input['description']) ? trim($input['description']) : null;
    if ($description !== null && strlen($description) > 2048) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Description must be 2048 characters or less']);
        return;
    }

    // Sanitize code if provided
    $newCode = null;
    if (isset($input['code'])) {
        $rawCode = $input['code'];
        if ($rawCode !== null) {
            $newCode = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $rawCode);
        } else {
            $newCode = '';
        }
    }
    // Validate code length (max 1MB)
    if ($newCode !== null && strlen($newCode) > 1048576) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Code must be 1MB or less']);
        return;
    }

    try {
        $pdo->beginTransaction();

        // Update snippet (only if code provided)
        if ($newCode !== null) {
            $stmt = $pdo->prepare("UPDATE snippets SET title = :title, code = :code, language = :language, description = :description WHERE id = :id");
            $stmt->execute([
                ':title' => $title,
                ':code' => $newCode,
                ':language' => $language,
                ':description' => $description,
                ':id' => $id
            ]);
        } else {
            $stmt = $pdo->prepare("UPDATE snippets SET title = :title, language = :language, description = :description WHERE id = :id");
            $stmt->execute([
                ':title' => $title,
                ':language' => $language,
                ':description' => $description,
                ':id' => $id
            ]);
        }

        // Replace tags: delete old links and insert new ones
        $delStmt = $pdo->prepare("DELETE FROM snippet_tags WHERE snippet_id = :sid");
        $delStmt->execute([':sid' => $id]);

        if (!empty($input['tags']) && is_array($input['tags'])) {
            foreach ($input['tags'] as $tagName) {
                $tagName = strtolower(trim($tagName));
                if (empty($tagName)) continue;
                // Validate tag length
                if (strlen($tagName) > 100) continue;

                // Insert or get tag id
                $tagStmt = $pdo->prepare("INSERT IGNORE INTO tags (name) VALUES (:name)");
                $tagStmt->execute([':name' => $tagName]);
                $tagId = $pdo->lastInsertId();

                if (!$tagId) {
                    $tagStmt = $pdo->prepare("SELECT id FROM tags WHERE name = :name");
                    $tagStmt->execute([':name' => $tagName]);
                    $tagId = $tagStmt->fetchColumn();
                }

                // Link snippet and tag
                $linkStmt = $pdo->prepare("INSERT IGNORE INTO snippet_tags (snippet_id, tag_id) VALUES (:sid, :tid)");
                $linkStmt->execute([':sid' => $id, ':tid' => $tagId]);
            }
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Snippet updated successfully',
            'data' => ['id' => $id]
        ]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log('Update snippet error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to update snippet']);
    }
}

/**
 * Delete a snippet
 */
function handleDelete(PDO $pdo): void {
    // CSRF validation for DELETE
    if (!csrf_validate()) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'CSRF validation failed']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    // Delete ID from body only (not GET to prevent CSRF via URL)
    $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT) ?? ($input['id'] ?? null);

    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'ID is required']);
        return;
    }

    // Verify snippet exists before deleting
    $checkStmt = $pdo->prepare("SELECT id FROM snippets WHERE id = :id");
    $checkStmt->execute([':id' => $id]);
    if (!$checkStmt->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Snippet not found']);
        return;
    }

         try {
          $pdo->beginTransaction();

          // Get tag IDs associated with this snippet before deleting
          $tagStmt = $pdo->prepare("SELECT st.tag_id FROM snippet_tags st WHERE st.snippet_id = :sid");
          $tagStmt->execute([':sid' => $id]);
          $tagIds = $tagStmt->fetchAll(PDO::FETCH_COLUMN);

         // Delete snippet
         $stmt = $pdo->prepare("DELETE FROM snippets WHERE id = :id");
         $stmt->execute([':id' => $id]);

         if ($stmt->rowCount() === 0) {
             $pdo->rollBack();
             http_response_code(404);
             echo json_encode(['success' => false, 'message' => 'Snippet not found']);
             return;
         }

         // Delete snippet-tag links for this snippet
         $delStmt = $pdo->prepare("DELETE FROM snippet_tags WHERE snippet_id = :sid");
         $delStmt->execute([':sid' => $id]);

          // Remove orphaned tags (tags no longer linked to any snippet)
          if (!empty($tagIds)) {
              $placeholders = implode(',', array_fill(0, count($tagIds), '?'));
              $delStmt = $pdo->prepare("DELETE FROM tags WHERE id IN ({$placeholders}) AND id NOT IN (SELECT DISTINCT tag_id FROM snippet_tags)");
              foreach ($tagIds as $i => $tid) {
                  $delStmt->bindValue($i + 1, $tid, PDO::PARAM_INT);
              }
              $delStmt->execute();
          }

         $pdo->commit();

          echo json_encode([
              'success' => true,
              'message' => 'Snippet deleted successfully'
          ]);
      } catch (PDOException $e) {
          $pdo->rollBack();
          error_log('Delete snippet error: ' . $e->getMessage());
          http_response_code(500);
          echo json_encode(['success' => false, 'message' => 'Failed to delete snippet']);
      }
  }

  /**
   * Share a snippet (generate public token)
   */
  function handleShare(PDO $pdo): void {
      // CSRF validation for share
      if (!csrf_validate()) {
          http_response_code(403);
          echo json_encode(['success' => false, 'message' => 'CSRF validation failed']);
          return;
      }

      $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
      if (!$id) {
          http_response_code(400);
          echo json_encode(['success' => false, 'message' => 'ID is required']);
          return;
      }

      // Check if already shared
      $checkStmt = $pdo->prepare("SELECT is_public FROM snippets WHERE id = :id");
      $checkStmt->execute([':id' => $id]);
      $exists = $checkStmt->fetch();

      if (!$exists) {
          http_response_code(404);
          echo json_encode(['success' => false, 'message' => 'Snippet not found']);
          return;
      }

      if ($exists['is_public']) {
          // Already shared — just return the token
          $stmt = $pdo->prepare("SELECT share_token FROM snippets WHERE id = :id");
          $stmt->execute([':id' => $id]);
          echo json_encode(['success' => true, 'data' => ['share_token' => $stmt->fetchColumn()]]);
          return;
      }

      // Generate token
      $token = bin2hex(random_bytes(16));

      $stmt = $pdo->prepare("UPDATE snippets SET share_token = :token, is_public = 1 WHERE id = :id");
      $stmt->execute([':token' => $token, ':id' => $id]);

      echo json_encode([
          'success' => true,
          'message' => 'Snippet shared successfully',
          'data' => ['share_token' => $token]
      ]);
  }

  /**
   * Unshare a snippet (revoke public token)
   */
  function handleUnshare(PDO $pdo): void {
      // CSRF validation for unshare
      if (!csrf_validate()) {
          http_response_code(403);
          echo json_encode(['success' => false, 'message' => 'CSRF validation failed']);
          return;
      }

      $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
      if (!$id) {
          http_response_code(400);
          echo json_encode(['success' => false, 'message' => 'ID is required']);
          return;
      }

      $stmt = $pdo->prepare("UPDATE snippets SET share_token = NULL, is_public = 0 WHERE id = :id");
      $stmt->execute([':id' => $id]);

      echo json_encode([
          'success' => true,
          'message' => 'Sharing revoked successfully'
      ]);
  }
