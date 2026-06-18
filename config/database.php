<?php
/**
 * Database configuration class using PDO
 */
class Database {
    private const HOST = 'localhost';
    private const PORT = '3306';
    private const DB_NAME = 'snippet_manager';

    // Credentials from environment variables (production-safe) or fall back to defaults
    private static function getDbUser(): string {
        return getenv('DB_USER') ?: 'root';
    }

    private static function getDbPass(): string {
        return getenv('DB_PASS') ?: '';
    }

    private ?PDO $connection = null;

    public function __construct() {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            self::HOST,
            self::PORT,
            self::DB_NAME
        );

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        try {
            $this->connection = new PDO($dsn, self::getDbUser(), self::getDbPass(), $options);
        } catch (PDOException $e) {
            error_log('Database connection failed: ' . $e->getMessage());
            die(json_encode([
                'success' => false,
                'message' => 'Database connection failed. Please try again later.'
            ]));
        }
    }

    public function getConnection(): PDO {
        return $this->connection;
    }
}