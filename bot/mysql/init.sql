CREATE DATABASE IF NOT EXISTS nash_dom
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nash_dom;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  max_user_id BIGINT NOT NULL,
  username VARCHAR(255) NULL,
  first_name VARCHAR(255) NULL,
  last_name VARCHAR(255) NULL,
  role ENUM('resident', 'uk', 'admin') NULL,
  consent_accepted TINYINT(1) NOT NULL DEFAULT 0,
  consent_accepted_at DATETIME NULL,
  onboarding_step VARCHAR(64) NOT NULL DEFAULT 'welcome',
  full_name VARCHAR(255) NULL,
  phone VARCHAR(32) NULL,
  personal_account VARCHAR(64) NULL,
  city_slug VARCHAR(128) NULL,
  pending_city_slug VARCHAR(128) NULL,
  pending_city_display VARCHAR(255) NULL,
  flow_step VARCHAR(64) NULL,
  flow_json TEXT NULL,
  registration_address VARCHAR(512) NULL,
  company_id BIGINT UNSIGNED NULL,
  uk_status ENUM('none', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'none',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_max_user_id (max_user_id),
  KEY idx_users_role (role),
  KEY idx_users_uk_status (uk_status),
  KEY idx_users_city (city_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(128) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cities_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS management_companies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  city_slug VARCHAR(128) NULL,
  phone VARCHAR(32) NULL,
  email VARCHAR(255) NULL,
  address VARCHAR(512) NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  requested_by_user_id BIGINT UNSIGNED NULL,
  approved_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mc_status (status),
  KEY idx_mc_city (city_slug),
  CONSTRAINT fk_mc_requested_by
    FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_mc_approved_by
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users
  ADD CONSTRAINT fk_users_company
  FOREIGN KEY (company_id) REFERENCES management_companies(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS addresses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  address_text VARCHAR(512) NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_addresses_user (user_id),
  CONSTRAINT fk_addresses_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_number VARCHAR(32) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  company_id BIGINT UNSIGNED NULL,
  type ENUM('emergency', 'regular') NOT NULL,
  category VARCHAR(128) NOT NULL,
  address_text VARCHAR(512) NOT NULL,
  description TEXT NULL,
  photo_token VARCHAR(512) NULL,
  status ENUM('new', 'in_progress', 'done', 'rejected') NOT NULL DEFAULT 'new',
  uk_comment TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_requests_public_number (public_number),
  KEY idx_requests_user (user_id),
  KEY idx_requests_company (company_id),
  KEY idx_requests_status (status),
  CONSTRAINT fk_requests_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_requests_company
    FOREIGN KEY (company_id) REFERENCES management_companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS request_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id BIGINT UNSIGNED NOT NULL,
  author_user_id BIGINT UNSIGNED NULL,
  author_role ENUM('uk', 'resident') NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rm_request (request_id),
  CONSTRAINT fk_rm_request FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  author_user_id BIGINT UNSIGNED NULL,
  title VARCHAR(255) NULL,
  body TEXT NOT NULL,
  recipients_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_announcements_company (company_id),
  CONSTRAINT fk_announcements_company
    FOREIGN KEY (company_id) REFERENCES management_companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_announcements_author
    FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resident_uk_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  company_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rur_user (user_id),
  KEY idx_rur_company (company_id),
  KEY idx_rur_status (status),
  CONSTRAINT fk_rur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_rur_company FOREIGN KEY (company_id) REFERENCES management_companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_settings (
  user_id BIGINT UNSIGNED NOT NULL,
  status_changes TINYINT(1) NOT NULL DEFAULT 1,
  water_shutdowns TINYINT(1) NOT NULL DEFAULT 1,
  broadcasts TINYINT(1) NOT NULL DEFAULT 1,
  parking_alerts TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO cities (slug, display_name) VALUES
  ('москва', 'Москва'),
  ('санкт_петербург', 'Санкт-Петербург'),
  ('набережные_челны', 'Набережные Челны'),
  ('казань', 'Казань'),
  ('новосибирск', 'Новосибирск'),
  ('екатеринбург', 'Екатеринбург'),
  ('нижний_новгород', 'Нижний Новгород'),
  ('самара', 'Самара'),
  ('омск', 'Омск'),
  ('ростов_на_дону', 'Ростов-на-Дону'),
  ('уфа', 'Уфа'),
  ('красноярск', 'Красноярск'),
  ('воронеж', 'Воронеж'),
  ('пермь', 'Пермь'),
  ('волгоград', 'Волгоград'),
  ('краснодар', 'Краснодар'),
  ('саратов', 'Саратов'),
  ('тюмень', 'Тюмень'),
  ('тольятти', 'Тольятти'),
  ('ижевск', 'Ижевск'),
  ('барнаул', 'Барнаул'),
  ('ульяновск', 'Ульяновск'),
  ('иркутск', 'Иркутск'),
  ('хабаровск', 'Хабаровск'),
  ('ярославль', 'Ярославль'),
  ('владивосток', 'Владивосток'),
  ('махачкала', 'Махачкала'),
  ('томск', 'Томск'),
  ('оренбург', 'Оренбург'),
  ('кемерово', 'Кемерово'),
  ('новокузнецк', 'Новокузнецк'),
  ('рязань', 'Рязань'),
  ('астрахань', 'Астрахань'),
  ('пенза', 'Пенза'),
  ('липецк', 'Липецк'),
  ('киров', 'Киров'),
  ('чебоксары', 'Чебоксары'),
  ('калининград', 'Калининград'),
  ('тула', 'Тула'),
  ('курск', 'Курск'),
  ('сочи', 'Сочи'),
  ('ставрополь', 'Ставрополь'),
  ('тверь', 'Тверь'),
  ('магнитогорск', 'Магнитогорск'),
  ('иваново', 'Иваново'),
  ('брянск', 'Брянск'),
  ('белгород', 'Белгород'),
  ('сургут', 'Сургут'),
  ('владимир', 'Владимир'),
  ('архангельск', 'Архангельск'),
  ('калуга', 'Калуга'),
  ('смоленск', 'Смоленск'),
  ('чита', 'Чита'),
  ('саранск', 'Саранск'),
  ('вологда', 'Вологда'),
  ('якутск', 'Якутск'),
  ('грозный', 'Грозный'),
  ('таганрог', 'Таганрог'),
  ('стерлитамак', 'Стерлитамак'),
  ('кострома', 'Кострома'),
  ('петрозаводск', 'Петрозаводск'),
  ('нижнекамск', 'Нижнекамск'),
  ('йошкар_ола', 'Йошкар-Ола'),
  ('новороссийск', 'Новороссийск'),
  ('химки', 'Химки'),
  ('балашиха', 'Балашиха'),
  ('подольск', 'Подольск'),
  ('мытищи', 'Мытищи'),
  ('королев', 'Королёв'),
  ('люберцы', 'Люберцы')
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);
