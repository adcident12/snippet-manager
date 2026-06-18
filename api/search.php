<?php
/**
 * Search API - Full-text search and tag filtering
 */
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/_headers.php';
require_once __DIR__ . '/../config/database.php';

$pdo = (new Database())->getConnection();

$query = trim($_GET['q'] ?? '');
$tag   = trim($_GET['tag'] ?? '');
$limit = filter_input(INPUT_GET, 'limit', FILTER_VALIDATE_INT) ?: 50;
if ($limit > 200) $limit = 200;
if ($limit < 1) $limit = 50;

if (empty($query) && empty($tag)) {
    echo json_encode(['success' => false, 'message' => 'Search query or tag filter required']);
    exit;
}

$whereClauses = [];
$params = [];

// Full-text search on title, code, description
if ($query) {
    // Escape MySQL boolean operators to avoid FT query errors
    $queryEscaped = preg_replace('/\b(OR|AND NOT|AND|NOT)\b/i', ' + ', $query);
    $queryEscaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $queryEscaped);
    $whereClauses[] = "MATCH(s.title, s.code, s.description) AGAINST(:query IN NATURAL LANGUAGE MODE)";
    $params[':query'] = $queryEscaped;
}

// Tag filter — use EXISTS to avoid column ambiguity (prepared statement handles escaping)
if ($tag) {
    $whereClauses[] = "EXISTS (SELECT 1 FROM snippet_tags st2 INNER JOIN tags t2 ON st2.tag_id = t2.id WHERE st2.snippet_id = s.id AND t2.name = :tag)";
    $params[':tag'] = $tag;
}

 $whereSql = !empty($whereClauses) ? 'WHERE ' . implode(' AND ', $whereClauses) : '';

 $sql = "SELECT s.*, GROUP_CONCAT(t.name ORDER BY t.name SEPARATOR ',') as tag_names FROM snippets s LEFT JOIN snippet_tags st ON s.id = st.snippet_id LEFT JOIN tags t ON st.tag_id = t.id {$whereSql} GROUP BY s.id ORDER BY s.updated_at DESC LIMIT :limit";

 $stmt = $pdo->prepare($sql);

 // Bind all params
 foreach ($params as $k => $v) {
     $stmt->bindValue($k, $v, PDO::PARAM_STR);
 }
 $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$stmt->execute();

$snippets = $stmt->fetchAll();

foreach ($snippets as &$snippet) {
    $snippet['tags'] = $snippet['tag_names'] ? explode(',', $snippet['tag_names']) : [];
    unset($snippet['tag_names']);
}
unset($snippet); // Break reference (fix reference leak)

echo json_encode([
    'success' => true,
    'data' => $snippets,
    'meta' => ['query' => $query, 'tag' => $tag]
]);