-- Personal Snippet Manager Database Schema
-- Run this SQL in MySQL to create the database and tables

CREATE DATABASE IF NOT EXISTS `snippet_manager` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `snippet_manager`;

-- Table: snippets
CREATE TABLE IF NOT EXISTS `snippets` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `code` TEXT NOT NULL,
    `language` VARCHAR(50) DEFAULT 'plaintext',
    `description` TEXT DEFAULT NULL,
    `share_token` VARCHAR(64) DEFAULT NULL UNIQUE,
    `is_public` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FULLTEXT KEY `idx_search` (`title`, `code`, `description`),
    INDEX `idx_share_token` (`share_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: tags
CREATE TABLE IF NOT EXISTS `tags` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_tag_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: snippet_tags (many-to-many)
CREATE TABLE IF NOT EXISTS `snippet_tags` (
    `snippet_id` INT UNSIGNED NOT NULL,
    `tag_id` INT UNSIGNED NOT NULL,
    PRIMARY KEY (`snippet_id`, `tag_id`),
    KEY `idx_tag_id` (`tag_id`),
    CONSTRAINT `fk_snippet_tags_snippet` FOREIGN KEY (`snippet_id`) REFERENCES `snippets` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_snippet_tags_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample data (optional)
INSERT INTO `tags` (`name`) VALUES ('php'), ('javascript'), ('css'), ('python'), ('general');

-- Performance: Add index for faster snippet_id lookups (helps DELETE and orphan cleanup)
CREATE INDEX IF NOT EXISTS `idx_snippet_id` ON `snippet_tags` (`snippet_id`);
