-- Intelligent Monitoring System database schema
-- Execute in MySQL 8+ to provision required tables

CREATE DATABASE IF NOT EXISTS `monitor` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `monitor`;

-- Reports table stores aggregated SDK payloads (errors + performance + actions)
CREATE TABLE IF NOT EXISTS `reports` (
  `id` CHAR(36) NOT NULL,
  `project_id` VARCHAR(128) NOT NULL,
  `error_logs` JSON NULL,
  `performance` JSON NULL,
  `actions` JSON NULL,
  `processed_data` JSON NULL,
  `ai_analysis` LONGTEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_report_project_time` (`project_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Source map artifacts uploaded per project/version
CREATE TABLE IF NOT EXISTS `sourcemaps` (
  `id` CHAR(36) NOT NULL,
  `project_id` VARCHAR(128) NOT NULL,
  `version` VARCHAR(64) NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `parent_version` VARCHAR(64) NULL,
  `metadata` JSON NULL,
  `expires_at` DATETIME NULL,
  `uploaded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sourcemap_project_version` (`project_id`, `version`),
  KEY `idx_sourcemap_expiration` (`project_id`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Detailed error rows used by AI analysis & source map mapping history
CREATE TABLE IF NOT EXISTS `error_reports` (
  `id` CHAR(36) NOT NULL,
  `project_id` VARCHAR(128) NOT NULL,
  `service` VARCHAR(128) NOT NULL,
  `environment` VARCHAR(32) NOT NULL,
  `timestamp` DATETIME NOT NULL,
  `severity` VARCHAR(16) NOT NULL,
  `message` TEXT NOT NULL,
  `stack_trace` LONGTEXT NOT NULL,
  `source_map_id` VARCHAR(64) NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_error_report_project` (`project_id`),
  KEY `idx_error_report_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- helper view listing latest sourcemap per project/version
CREATE OR REPLACE VIEW `v_latest_sourcemaps` AS
SELECT
  s.`project_id`,
  s.`version`,
  s.`filename`,
  s.`uploaded_at`,
  s.`expires_at`
FROM `sourcemaps` s
JOIN (
  SELECT `project_id`, `version`, MAX(`uploaded_at`) AS `max_uploaded`
  FROM `sourcemaps`
  GROUP BY `project_id`, `version`
) latest
  ON latest.`project_id` = s.`project_id`
 AND latest.`version` = s.`version`
 AND latest.`max_uploaded` = s.`uploaded_at`;
