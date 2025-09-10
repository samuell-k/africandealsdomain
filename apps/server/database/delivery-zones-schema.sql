-- Delivery Zones Schema
-- This file contains the SQL schema for delivery zones and related tables

-- Create delivery_zones table if it doesn't exist
CREATE TABLE IF NOT EXISTS `delivery_zones` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `color` VARCHAR(50) DEFAULT '#3388ff',
  `geojson` JSON NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_delivery_zones_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create zone_agent_assignments table if it doesn't exist
CREATE TABLE IF NOT EXISTS `zone_agent_assignments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `zone_id` INT NOT NULL,
  `agent_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_zone_agent` (`zone_id`, `agent_id`),
  CONSTRAINT `fk_zone_agent_zone_id` FOREIGN KEY (`zone_id`) REFERENCES `delivery_zones` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_zone_agent_agent_id` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  INDEX `idx_zone_agent_assignments_agent_id` (`agent_id`),
  INDEX `idx_zone_agent_assignments_zone_id` (`zone_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;