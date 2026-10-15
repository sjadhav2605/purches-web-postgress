-- ============================================================================
-- DDPL Procurement Portal - Production MySQL Schema
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `ddpl_procurement`
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `ddpl_procurement`;

-- Disable foreign key checks during setup
SET FOREIGN_KEY_CHECKS = 0;

-- 1. SITES TABLE
DROP TABLE IF EXISTS `sites`;
CREATE TABLE `sites` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(50) NOT NULL UNIQUE,
    `name` VARCHAR(200) NOT NULL,
    `address` TEXT NOT NULL,
    `gstin` VARCHAR(20) NULL,
    `active` BOOLEAN DEFAULT TRUE,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_sites_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. VENDORS TABLE
DROP TABLE IF EXISTS `vendors`;
CREATE TABLE `vendors` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(200) NOT NULL,
    `gstin` VARCHAR(20) NULL,
    `pan` VARCHAR(20) NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(25) NULL,
    `address` TEXT NULL,
    `categories` JSON NULL,
    `advance_pct` DECIMAL(5, 2) DEFAULT 0.00,
    `credit_days` INT DEFAULT 0,
    `active` BOOLEAN DEFAULT TRUE,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_vendors_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. USERS TABLE
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `role` ENUM('admin', 'director', 'purchase', 'pc', 'accounts', 'supervisor', 'vendor') NOT NULL,
    `status` ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    `vendor_id` INT NULL,
    `default_site_id` INT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_users_email` (`email`),
    INDEX `idx_users_role` (`role`),
    FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`default_site_id`) REFERENCES `sites`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. MATERIALS TABLE
DROP TABLE IF EXISTS `materials`;
CREATE TABLE `materials` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `description` VARCHAR(255) NOT NULL,
    `spec` TEXT NULL,
    `unit` VARCHAR(50) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `hsn` VARCHAR(20) NULL,
    `ref_rate` DECIMAL(12, 2) DEFAULT 0.00,
    `active` BOOLEAN DEFAULT TRUE,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_materials_category` (`category`),
    INDEX `idx_materials_desc` (`description`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. REQUISITIONS TABLE (PR)
DROP TABLE IF EXISTS `requisitions`;
CREATE TABLE `requisitions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `pr_no` VARCHAR(50) NOT NULL UNIQUE,
    `site_id` INT NOT NULL,
    `requested_by_id` INT NOT NULL,
    `category` VARCHAR(150) NOT NULL,
    `status` VARCHAR(100) NOT NULL DEFAULT 'Raised',
    `required_by_date` DATE NULL,
    `remarks` TEXT NULL,
    `decline_reason` TEXT NULL,
    `approved_by` VARCHAR(150) NULL,
    `approved_by_id` INT NULL,
    `approved_at` DATETIME NULL,
    `declined_by` VARCHAR(150) NULL,
    `declined_by_id` INT NULL,
    `declined_at` DATETIME NULL,
    `shortlisted_vendor_id` INT NULL,
    `dispatch_date` DATE NULL,
    `vehicle_no` VARCHAR(100) NULL,
    `transport_name` VARCHAR(150) NULL,
    `challan_no` VARCHAR(100) NULL,
    `dispatched_qty` DECIMAL(12, 3) NULL,
    `dispatch_remarks` TEXT NULL,
    `history` JSON NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    INDEX `idx_pr_no` (`pr_no`),
    INDEX `idx_pr_status` (`status`),
    INDEX `idx_pr_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. REQUISITION_ITEMS TABLE
DROP TABLE IF EXISTS `requisition_items`;
CREATE TABLE `requisition_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `requisition_id` INT NOT NULL,
    `material_id` INT NULL,
    `description` VARCHAR(255) NOT NULL,
    `spec` TEXT NULL,
    `unit` VARCHAR(50) NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `est_rate` DECIMAL(12, 2) DEFAULT 0.00,
    `is_custom` BOOLEAN DEFAULT FALSE,
    `justification` TEXT NULL,
    `photos` JSON NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`requisition_id`) REFERENCES `requisitions`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE SET NULL,
    INDEX `idx_req_items_req_id` (`requisition_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. RFQS TABLE
DROP TABLE IF EXISTS `rfqs`;
CREATE TABLE `rfqs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `rfq_no` VARCHAR(50) NOT NULL UNIQUE,
    `requisition_id` INT NOT NULL,
    `site_id` INT NOT NULL,
    `current_rev` INT DEFAULT 0,
    `deadline` DATE NULL,
    `winner_vendor_id` INT NULL,
    `status` VARCHAR(50) DEFAULT 'Draft',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`requisition_id`) REFERENCES `requisitions`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`winner_vendor_id`) REFERENCES `vendors`(`id`) ON DELETE SET NULL,
    INDEX `idx_rfqs_req_id` (`requisition_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. RFQ_BIDS TABLE
DROP TABLE IF EXISTS `rfq_bids`;
CREATE TABLE `rfq_bids` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `rfq_id` INT NOT NULL,
    `revision_no` INT DEFAULT 0,
    `vendor_id` INT NOT NULL,
    `items` JSON NOT NULL,
    `lead_from` DATE NULL,
    `lead_to` DATE NULL,
    `delivery_days` INT NULL,
    `entered_by` VARCHAR(50) DEFAULT 'vendor',
    `status` VARCHAR(50) DEFAULT 'Submitted',
    `current_round` INT DEFAULT 0,
    `submitted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`rfq_id`) REFERENCES `rfqs`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT,
    UNIQUE KEY `uk_rfq_rev_vendor` (`rfq_id`, `revision_no`, `vendor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. PURCHASE_ORDERS TABLE (PO)
DROP TABLE IF EXISTS `purchase_orders`;
CREATE TABLE `purchase_orders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `po_no` VARCHAR(50) NOT NULL UNIQUE,
    `requisition_id` INT NOT NULL,
    `rfq_id` INT NULL,
    `vendor_id` INT NOT NULL,
    `site_id` INT NOT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `cgst` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `sgst` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `payment_terms` JSON NULL,
    `status` ENUM('Draft', 'Approved', 'Issued', 'Acknowledged', 'Dispatched', 'Partially Received', 'Site Verified', 'Cancelled') NOT NULL DEFAULT 'Approved',
    `approved_by_id` INT NULL,
    `verified_by_id` INT NULL,
    `pdf_file_path` VARCHAR(500) NULL,
    `invoice_no` VARCHAR(100) NULL,
    `dispatch_date` DATE NULL,
    `expected_delivery_date` DATE NULL,
    `dispatch_notes` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`requisition_id`) REFERENCES `requisitions`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`rfq_id`) REFERENCES `rfqs`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`verified_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    INDEX `idx_po_no` (`po_no`),
    INDEX `idx_po_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. DELIVERIES TABLE
DROP TABLE IF EXISTS `deliveries`;
CREATE TABLE `deliveries` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `po_id` INT NOT NULL,
    `site_id` INT NOT NULL,
    `challan_no` VARCHAR(100) NULL,
    `received_date` DATE NOT NULL,
    `recorded_by_id` INT NOT NULL,
    `received_items` JSON NOT NULL,
    `challan_photos` JSON NULL,
    `material_photos` JSON NULL,
    `remarks` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    INDEX `idx_deliveries_po` (`po_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. PAYMENTS TABLE
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `po_id` INT NOT NULL,
    `vendor_id` INT NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `payment_date` DATE NOT NULL,
    `mode` ENUM('RTGS', 'NEFT', 'Cheque', 'UPI', 'Cash') NOT NULL,
    `reference_no` VARCHAR(100) NOT NULL,
    `note` TEXT NULL,
    `recorded_by_id` INT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    INDEX `idx_payments_po` (`po_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. AUDIT_LOGS TABLE
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` VARCHAR(100) NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `actor_id` INT NULL,
    `actor_name` VARCHAR(150) NULL,
    `note` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    INDEX `idx_audit_entity` (`entity_type`, `entity_id`),
    INDEX `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. NOTIFICATIONS TABLE
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL,
    `vendor_id` INT NULL,
    `role` VARCHAR(50) NULL,
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `link` VARCHAR(255) NULL,
    `type` VARCHAR(50) DEFAULT 'info',
    `is_read` BOOLEAN DEFAULT FALSE,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_notif_user` (`user_id`),
    INDEX `idx_notif_vendor` (`vendor_id`),
    INDEX `idx_notif_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. BID_REVISIONS TABLE
DROP TABLE IF EXISTS `bid_revisions`;
CREATE TABLE `bid_revisions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `rfq_id` INT NOT NULL,
    `bid_id` INT NOT NULL,
    `vendor_id` INT NOT NULL,
    `round` INT NOT NULL DEFAULT 1,
    `status` ENUM('Revision Requested', 'Revised Bid Submitted', 'Accepted', 'Rejected') DEFAULT 'Revision Requested',
    `requested_by_id` INT NULL,
    `request_remarks` TEXT NULL,
    `response_type` ENUM('accepted', 'counter', 'original') NULL,
    `vendor_remarks` TEXT NULL,
    `subtotal` DECIMAL(14, 2) DEFAULT 0.00,
    `cgst` DECIMAL(14, 2) DEFAULT 0.00,
    `sgst` DECIMAL(14, 2) DEFAULT 0.00,
    `total_amount` DECIMAL(14, 2) DEFAULT 0.00,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `responded_at` DATETIME NULL,
    FOREIGN KEY (`rfq_id`) REFERENCES `rfqs`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`bid_id`) REFERENCES `rfq_bids`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    INDEX `idx_bid_rev_rfq` (`rfq_id`),
    INDEX `idx_bid_rev_bid` (`bid_id`),
    INDEX `idx_bid_rev_vendor` (`vendor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. BID_REVISION_ITEMS TABLE
DROP TABLE IF EXISTS `bid_revision_items`;
CREATE TABLE `bid_revision_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `revision_id` INT NOT NULL,
    `item_index` INT DEFAULT 0,
    `description` VARCHAR(255) NOT NULL,
    `spec` TEXT NULL,
    `unit` VARCHAR(50) NULL,
    `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1,
    `original_rate` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `revised_rate` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `final_rate` DECIMAL(12, 2) NULL,
    `availability` VARCHAR(50) DEFAULT 'Available',
    FOREIGN KEY (`revision_id`) REFERENCES `bid_revisions`(`id`) ON DELETE CASCADE,
    INDEX `idx_rev_items_rev_id` (`revision_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. STATUS_HISTORY TABLE
DROP TABLE IF EXISTS `status_history`;
CREATE TABLE `status_history` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` INT NOT NULL,
    `from_status` VARCHAR(100) NULL,
    `to_status` VARCHAR(100) NOT NULL,
    `action_by` VARCHAR(150) NOT NULL,
    `action_by_id` INT NULL,
    `role` VARCHAR(50) NOT NULL,
    `remark` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_sh_entity` (`entity_type`, `entity_id`),
    INDEX `idx_sh_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. REQUISITION_EDITS TABLE
DROP TABLE IF EXISTS `requisition_edits`;
CREATE TABLE `requisition_edits` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `requisition_id` INT NOT NULL,
    `field` VARCHAR(100) NOT NULL,
    `old_value` TEXT NULL,
    `new_value` TEXT NULL,
    `edited_by` VARCHAR(150) NOT NULL,
    `edited_by_id` INT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_req_edits_req_id` (`requisition_id`),
    FOREIGN KEY (`requisition_id`) REFERENCES `requisitions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. DELIVERY_RECEIPTS TABLE
DROP TABLE IF EXISTS `delivery_receipts`;
CREATE TABLE `delivery_receipts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `delivery_id` INT NULL,
    `requisition_id` INT NULL,
    `po_id` INT NULL,
    `received_by` VARCHAR(150) NOT NULL,
    `received_by_id` INT NULL,
    `received_qty` DECIMAL(12, 3) NULL,
    `proof_file` LONGTEXT NULL,
    `remark` TEXT NULL,
    `received_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_dr_del` (`delivery_id`),
    INDEX `idx_dr_req` (`requisition_id`),
    INDEX `idx_dr_po` (`po_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
