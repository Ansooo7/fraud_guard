-- ============================================================
--  FraudGuard — AI-Powered Banking Fraud Detection System
--  Database: fraudguard
--  Dialect:  MySQL 8.0+
--  Created:  2026-05-02
-- ============================================================

CREATE DATABASE IF NOT EXISTS fraudguard
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE fraudguard;

-- ============================================================
--  TABLE: users
--  Stores all registered users (admins, analysts, regular users)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              INT            AUTO_INCREMENT PRIMARY KEY,
  email           VARCHAR(255)   NOT NULL UNIQUE,
  name            VARCHAR(255)   NOT NULL,
  password_hash   TEXT           NOT NULL,
  role            ENUM('admin','analyst','user') NOT NULL DEFAULT 'user',
  email_verified  BOOLEAN        NOT NULL DEFAULT TRUE,
  email_verified_at DATETIME     DEFAULT NULL,
  created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_role  (role)
);

-- ============================================================
--  TABLE: transactions
--  Every payment transaction submitted through the system
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id                 INT             AUTO_INCREMENT PRIMARY KEY,
  user_id            INT             NOT NULL,
  amount             DECIMAL(15, 2)  NOT NULL,
  currency           VARCHAR(10)     NOT NULL DEFAULT 'USD',
  merchant_name      VARCHAR(255)    NOT NULL,
  merchant_category  VARCHAR(100)    DEFAULT NULL,
  location           VARCHAR(255)    NOT NULL,
  device_id          VARCHAR(255)    DEFAULT NULL,
  ip_address         VARCHAR(50)     DEFAULT NULL,
  card_bin           VARCHAR(10)     DEFAULT NULL,
  status             ENUM('pending','approved','flagged','blocked') NOT NULL DEFAULT 'pending',
  risk_level         ENUM('low','medium','high','critical')         NOT NULL DEFAULT 'low',
  fraud_score        FLOAT           NOT NULL DEFAULT 0,
  anomaly_score      FLOAT           NOT NULL DEFAULT 0,
  fraud_reason       TEXT            DEFAULT NULL,
  created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_transactions_user_id    (user_id),
  INDEX idx_transactions_status     (status),
  INDEX idx_transactions_risk_level (risk_level),
  INDEX idx_transactions_created_at (created_at)
);

-- ============================================================
--  TABLE: fraud_alerts
--  Alert raised automatically when a transaction is flagged/blocked
-- ============================================================
CREATE TABLE IF NOT EXISTS fraud_alerts (
  id             INT     AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT     NOT NULL,
  user_id        INT     NOT NULL,
  severity       ENUM('low','medium','high','critical') NOT NULL,
  reason         TEXT    NOT NULL,
  fraud_score    FLOAT   NOT NULL,
  anomaly_score  FLOAT   NOT NULL,
  resolved       BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at    DATETIME DEFAULT NULL,
  resolved_by    INT      DEFAULT NULL,
  notes          TEXT     DEFAULT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)        REFERENCES users(id)        ON DELETE CASCADE,
  FOREIGN KEY (resolved_by)    REFERENCES users(id)        ON DELETE SET NULL,
  INDEX idx_alerts_transaction_id (transaction_id),
  INDEX idx_alerts_user_id        (user_id),
  INDEX idx_alerts_severity       (severity),
  INDEX idx_alerts_resolved       (resolved),
  INDEX idx_alerts_created_at     (created_at)
);

-- ============================================================
--  TABLE: risk_profiles
--  Running risk score summary per user (updated on each transaction)
-- ============================================================
CREATE TABLE IF NOT EXISTS risk_profiles (
  id                       INT     AUTO_INCREMENT PRIMARY KEY,
  user_id                  INT     NOT NULL UNIQUE,
  risk_score               FLOAT   NOT NULL DEFAULT 0,
  transaction_count        INT     NOT NULL DEFAULT 0,
  flagged_count            INT     NOT NULL DEFAULT 0,
  blocked_count            INT     NOT NULL DEFAULT 0,
  avg_transaction_amount   FLOAT   NOT NULL DEFAULT 0,
  max_transaction_amount   FLOAT   NOT NULL DEFAULT 0,
  unique_locations         INT     NOT NULL DEFAULT 0,
  unique_devices           INT     NOT NULL DEFAULT 0,
  last_activity_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_risk_profiles_user_id    (user_id),
  INDEX idx_risk_profiles_risk_score (risk_score)
);

-- ============================================================
--  TABLE: fraud_rules
--  Custom rules created by analysts to flag/block transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS fraud_rules (
  id               INT          AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  description      TEXT         DEFAULT NULL,
  conditions       JSON         NOT NULL,
  condition_logic  VARCHAR(10)  NOT NULL DEFAULT 'AND',
  action           VARCHAR(20)  NOT NULL,   -- flag | block | approve
  priority         INT          NOT NULL DEFAULT 100,
  enabled          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by       INT          DEFAULT NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_fraud_rules_enabled  (enabled),
  INDEX idx_fraud_rules_priority (priority)
);

-- ============================================================
--  TABLE: fraud_cases
--  Investigation cases opened by analysts for suspected fraud
-- ============================================================
CREATE TABLE IF NOT EXISTS fraud_cases (
  id               INT           AUTO_INCREMENT PRIMARY KEY,
  title            VARCHAR(255)  NOT NULL,
  description      TEXT          DEFAULT NULL,
  status           ENUM('open','under_review','resolved','dismissed') NOT NULL DEFAULT 'open',
  priority         ENUM('low','medium','high','critical')             NOT NULL DEFAULT 'medium',
  alert_id         INT           DEFAULT NULL,
  transaction_ref  VARCHAR(100)  DEFAULT NULL,
  merchant_name    VARCHAR(255)  DEFAULT NULL,
  amount           FLOAT         DEFAULT NULL,
  location         VARCHAR(255)  DEFAULT NULL,
  assigned_to      INT           DEFAULT NULL,
  created_by       INT           DEFAULT NULL,
  resolved_at      DATETIME      DEFAULT NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (alert_id)    REFERENCES fraud_alerts(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES users(id)        ON DELETE SET NULL,
  FOREIGN KEY (created_by)  REFERENCES users(id)        ON DELETE SET NULL,
  INDEX idx_cases_status      (status),
  INDEX idx_cases_priority    (priority),
  INDEX idx_cases_assigned_to (assigned_to),
  INDEX idx_cases_created_at  (created_at)
);

-- ============================================================
--  TABLE: case_notes
--  Internal threaded comments on a fraud case (like a ticket)
-- ============================================================
CREATE TABLE IF NOT EXISTS case_notes (
  id          INT      AUTO_INCREMENT PRIMARY KEY,
  case_id     INT      NOT NULL,
  content     TEXT     NOT NULL,
  created_by  INT      DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id)    REFERENCES fraud_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)       ON DELETE SET NULL,
  INDEX idx_case_notes_case_id (case_id)
);

-- ============================================================
--  TABLE: notifications
--  In-app bell notifications (case assigned, note added, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  user_id     INT           NOT NULL,
  type        VARCHAR(50)   NOT NULL,
  title       VARCHAR(255)  NOT NULL,
  message     TEXT          DEFAULT NULL,
  case_id     INT           DEFAULT NULL,
  is_read     BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user_id    (user_id),
  INDEX idx_notifications_is_read    (is_read),
  INDEX idx_notifications_created_at (created_at)
);

-- ============================================================
--  TABLE: entity_blocklist
--  Blocked or allowed IPs, card BINs, emails, devices, merchants
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_blocklist (
  id            INT           AUTO_INCREMENT PRIMARY KEY,
  entity_type   VARCHAR(30)   NOT NULL,  -- ip | bin | email | device_id | merchant_id
  entity_value  VARCHAR(255)  NOT NULL,
  action        VARCHAR(10)   NOT NULL DEFAULT 'block',  -- block | allow
  reason        TEXT          DEFAULT NULL,
  created_by    VARCHAR(255)  DEFAULT NULL,
  active        BOOLEAN       NOT NULL DEFAULT TRUE,
  hit_count     INT           NOT NULL DEFAULT 0,
  last_hit_at   DATETIME      DEFAULT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_blocklist_type_value (entity_type, entity_value),
  INDEX idx_blocklist_active     (active)
);

-- ============================================================
--  TABLE: email_verification_tokens
--  Magic link tokens for email verification (kept for reference)
-- ============================================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id          INT      AUTO_INCREMENT PRIMARY KEY,
  user_id     INT      NOT NULL,
  token       TEXT     NOT NULL,
  expires_at  DATETIME NOT NULL,
  used_at     DATETIME DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_evt_user_id (user_id)
);

-- ============================================================
--  TABLE: login_otps
--  One-time passwords for passwordless login (kept for reference)
-- ============================================================
CREATE TABLE IF NOT EXISTS login_otps (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(255)  NOT NULL,
  code        VARCHAR(10)   NOT NULL,
  expires_at  DATETIME      NOT NULL,
  used_at     DATETIME      DEFAULT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_otps_email (email),
  INDEX idx_login_otps_code  (code)
);


-- ============================================================
--  SAMPLE DATA
-- ============================================================

-- Demo users (passwords are bcrypt hashes of the plain text shown)
-- admin123 → hash | analyst123 → hash | user123 → hash
INSERT INTO users (email, name, password_hash, role, email_verified, email_verified_at, created_at) VALUES
  ('admin@fraudguard.io',   'Admin User',     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin',   TRUE, NOW(), NOW()),
  ('analyst@fraudguard.io', 'Jane Analyst',   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'analyst', TRUE, NOW(), NOW()),
  ('john.doe@example.com',  'John Doe',       '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user',    TRUE, NOW(), NOW()),
  ('sara.smith@example.com','Sara Smith',     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user',    TRUE, NOW(), NOW()),
  ('mike.chen@example.com', 'Mike Chen',      '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user',    TRUE, NOW(), NOW()),
  ('lisa.wong@example.com', 'Lisa Wong',      '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user',    TRUE, NOW(), NOW()),
  ('raj.patel@example.com', 'Raj Patel',      '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user',    TRUE, NOW(), NOW()),
  ('emma.jones@example.com','Emma Jones',     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user',    TRUE, NOW(), NOW());

-- Risk profiles
INSERT INTO risk_profiles (user_id, risk_score, transaction_count, flagged_count, blocked_count, avg_transaction_amount, max_transaction_amount, unique_locations, unique_devices, last_activity_at) VALUES
  (3, 0.12, 45, 2, 0, 120.50, 890.00, 3, 2, NOW()),
  (4, 0.67, 28, 7, 2, 340.00, 2500.00, 8, 5, NOW()),
  (5, 0.05, 92, 1, 0,  85.75, 450.00, 2, 1, NOW()),
  (6, 0.88, 15, 9, 4, 780.00, 4200.00, 12, 8, NOW());

-- Sample transactions
INSERT INTO transactions (user_id, amount, currency, merchant_name, merchant_category, location, device_id, ip_address, card_bin, status, risk_level, fraud_score, anomaly_score, fraud_reason, created_at) VALUES
  (3, 49.99,   'USD', 'Amazon',           'retail',       'New York, US',    'dev-001', '192.168.1.10', '411111', 'approved', 'low',      0.05, 0.03, NULL,                              NOW()),
  (3, 129.00,  'USD', 'Best Buy',         'electronics',  'New York, US',    'dev-001', '192.168.1.10', '411111', 'approved', 'low',      0.08, 0.05, NULL,                              NOW()),
  (4, 2500.00, 'USD', 'Crypto Exchange',  'crypto',       'Lagos, NG',       'dev-007', '41.58.12.100', '522222', 'blocked',  'critical', 0.97, 0.95, 'High-risk crypto merchant; unusual location; large amount', NOW()),
  (4, 890.00,  'USD', 'Wire Transfer Co', 'wire_transfer','Dubai, AE',       'dev-008', '41.58.12.101', '522222', 'flagged',  'high',     0.78, 0.72, 'Wire transfer category; new location; amount deviation',    NOW()),
  (5, 35.50,   'USD', 'Starbucks',        'food',         'San Francisco, US','dev-002','10.0.0.1',    '433333', 'approved', 'low',      0.02, 0.01, NULL,                              NOW()),
  (6, 4200.00, 'USD', 'Jewels & Co',      'jewelry',      'Moscow, RU',      'dev-012', '95.100.12.5', '544444', 'blocked',  'critical', 0.99, 0.98, 'Jewelry merchant; blocked IP; critical amount deviation',   NOW()),
  (6, 1200.00, 'USD', 'Casino Online',    'gambling',     'Amsterdam, NL',   'dev-013', '85.91.12.33', '544444', 'flagged',  'high',     0.81, 0.77, 'Gambling category; multiple new devices; large amount',     NOW()),
  (7, 75.00,   'USD', 'Uber',             'transport',    'Chicago, US',     'dev-003', '172.16.0.5',  '455555', 'approved', 'low',      0.04, 0.02, NULL,                              NOW()),
  (7, 320.00,  'USD', 'Apple Store',      'electronics',  'Chicago, US',     'dev-003', '172.16.0.5',  '455555', 'approved', 'medium',   0.22, 0.18, NULL,                              NOW()),
  (8, 560.00,  'USD', 'Unknown Merchant', 'other',        'Beijing, CN',     'dev-020', '114.80.1.2',  '499999', 'flagged',  'high',     0.74, 0.70, 'Unknown merchant; new location; new device',                NOW()),
  (3, 19.99,   'USD', 'Netflix',          'entertainment','New York, US',    'dev-001', '192.168.1.10','411111', 'approved', 'low',      0.01, 0.01, NULL,                              NOW()),
  (5, 220.00,  'USD', 'Delta Airlines',   'travel',       'Los Angeles, US', 'dev-002', '10.0.0.2',   '433333', 'approved', 'low',      0.10, 0.08, NULL,                              NOW());

-- Fraud alerts
INSERT INTO fraud_alerts (transaction_id, user_id, severity, reason, fraud_score, anomaly_score, resolved, created_at) VALUES
  (3,  4, 'critical', 'Crypto merchant transaction blocked — score 0.97',                       0.97, 0.95, FALSE, NOW()),
  (4,  4, 'high',     'Wire transfer flagged — unusual location and amount deviation',           0.78, 0.72, FALSE, NOW()),
  (6,  6, 'critical', 'Jewelry merchant in high-risk country — IP on blocklist',                0.99, 0.98, FALSE, NOW()),
  (7,  6, 'high',     'Gambling transaction flagged — multiple new devices detected',            0.81, 0.77, TRUE,  NOW()),
  (10, 8, 'high',     'Unknown merchant flagged — new location and device combination',         0.74, 0.70, FALSE, NOW());

-- Fraud rules
INSERT INTO fraud_rules (name, description, conditions, condition_logic, action, priority, enabled, created_by, created_at) VALUES
  ('Block Crypto Transactions',
   'Automatically block any transaction at a cryptocurrency exchange',
   '[{"field":"merchantCategory","operator":"equals","value":"crypto"}]',
   'AND', 'block', 1, TRUE, 1, NOW()),

  ('Flag Large Amounts',
   'Flag any single transaction over $5,000 for manual review',
   '[{"field":"amount","operator":"gt","value":5000}]',
   'AND', 'flag', 10, TRUE, 1, NOW()),

  ('Block Gambling Sites',
   'Block all gambling and casino-related transactions',
   '[{"field":"merchantCategory","operator":"equals","value":"gambling"}]',
   'AND', 'block', 2, TRUE, 1, NOW()),

  ('Flag High Fraud Score',
   'Flag any transaction where the fraud score exceeds 0.75',
   '[{"field":"fraudScore","operator":"gt","value":0.75}]',
   'AND', 'flag', 5, TRUE, 1, NOW()),

  ('Flag Wire Transfers over $500',
   'Flag wire transfers exceeding $500 for analyst review',
   '[{"field":"merchantCategory","operator":"equals","value":"wire_transfer"},{"field":"amount","operator":"gt","value":500}]',
   'AND', 'flag', 3, TRUE, 1, NOW()),

  ('Auto-Approve Low Risk',
   'Approve transactions with very low fraud score from known locations',
   '[{"field":"fraudScore","operator":"lt","value":0.10}]',
   'AND', 'approve', 100, TRUE, 1, NOW());

-- Fraud cases
INSERT INTO fraud_cases (title, description, status, priority, alert_id, transaction_ref, merchant_name, amount, location, assigned_to, created_by, created_at) VALUES
  ('Suspected Crypto Laundering — User 4',
   'User made a $2,500 transaction to a crypto exchange from an unusual IP in Lagos. Score 0.97. Requires immediate investigation.',
   'under_review', 'critical', 1, 'TXN-0003', 'Crypto Exchange', 2500.00, 'Lagos, NG', 2, 1, NOW()),

  ('Wire Transfer Anomaly — User 4',
   'Flagged wire transfer of $890 from Dubai. User has no history of international wire transfers.',
   'open', 'high', 2, 'TXN-0004', 'Wire Transfer Co', 890.00, 'Dubai, AE', 2, 1, NOW()),

  ('Jewelry Store Block — User 6',
   'Transaction to jewelry merchant in Moscow blocked due to blocklist IP and critical fraud score 0.99.',
   'open', 'critical', 3, 'TXN-0006', 'Jewels & Co', 4200.00, 'Moscow, RU', NULL, 1, NOW()),

  ('Unknown Merchant — User 8',
   'Transaction to an unknown merchant category from Beijing flagged. New device and new location combination.',
   'open', 'medium', 5, 'TXN-0010', 'Unknown Merchant', 560.00, 'Beijing, CN', 2, 1, NOW());

-- Case notes
INSERT INTO case_notes (case_id, content, created_by, created_at) VALUES
  (1, 'Opened investigation. Contacted compliance team. Checking if user has history of crypto activity.', 2, NOW()),
  (1, 'User account temporarily restricted pending outcome. No prior crypto transactions found in 12-month history.', 1, NOW()),
  (2, 'Reviewing IP geolocation data. The IP resolves to a VPN endpoint in Dubai.', 2, NOW());

-- Notifications
INSERT INTO notifications (user_id, type, title, message, case_id, is_read, created_at) VALUES
  (2, 'case_assigned',  'New Case Assigned',       'You have been assigned to case: Suspected Crypto Laundering — User 4',         1, FALSE, NOW()),
  (1, 'case_created',   'New Case Created',         'Case opened: Wire Transfer Anomaly — User 4',                                   2, FALSE, NOW()),
  (2, 'note_added',     'New Note on Your Case',    'Admin User added a note to: Suspected Crypto Laundering — User 4',             1, TRUE,  NOW()),
  (1, 'fraud_alert',    'Critical Fraud Alert',     'Transaction TXN-0006 blocked — score 0.99. Jewelry store in high-risk country.', 3, FALSE, NOW()),
  (2, 'case_assigned',  'New Case Assigned',        'You have been assigned to case: Unknown Merchant — User 8',                     4, FALSE, NOW());

-- Blocklist entries
INSERT INTO entity_blocklist (entity_type, entity_value, action, reason, created_by, active, hit_count, created_at) VALUES
  ('ip',          '95.100.12.5',   'block', 'Known fraud IP — linked to 14 chargebacks in Q1 2025',           'admin@fraudguard.io', TRUE,  3,  NOW()),
  ('ip',          '41.58.12.100',  'block', 'Tor exit node — high fraud association',                          'admin@fraudguard.io', TRUE,  7,  NOW()),
  ('bin',         '544444',        'block', 'Stolen card BIN reported by issuing bank',                        'admin@fraudguard.io', TRUE,  2,  NOW()),
  ('bin',         '522222',        'block', 'BIN associated with multiple fraud attempts',                     'admin@fraudguard.io', TRUE,  4,  NOW()),
  ('merchant_id', 'CRYPTO_001',    'block', 'Unlicensed crypto exchange operating in restricted jurisdictions','admin@fraudguard.io', TRUE,  9,  NOW()),
  ('device_id',   'dev-007',       'block', 'Device fingerprint linked to 3 fraud accounts',                  'analyst@fraudguard.io',TRUE, 2,  NOW()),
  ('email',       'fraud@scam.com','block', 'Email address used in phishing campaign',                         'admin@fraudguard.io', TRUE,  0,  NOW()),
  ('ip',          '192.168.1.10',  'allow', 'Internal office IP — always approve',                             'admin@fraudguard.io', TRUE,  11, NOW()),
  ('bin',         '411111',        'allow', 'Premium corporate card BIN — trusted issuer',                     'admin@fraudguard.io', TRUE,  8,  NOW());
