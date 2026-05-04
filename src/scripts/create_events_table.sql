-- Migration: Add events table
-- OC-PATHFINDER Event Search Feature
-- Run this on the database

CREATE TABLE IF NOT EXISTS events (
  event_id INT PRIMARY KEY AUTO_INCREMENT,
  event_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  node_id INT NOT NULL,
  start_datetime DATETIME,
  end_datetime DATETIME,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (node_id) REFERENCES nodes(node_id) ON DELETE CASCADE,
  
  INDEX idx_event_name (event_name),
  INDEX idx_category (category),
  INDEX idx_start_datetime (start_datetime),
  INDEX idx_node_id (node_id),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert sample events for testing
-- Note: Update node_id values to match actual nodes in your database
INSERT INTO events (event_name, description, category, node_id, start_datetime, end_datetime) VALUES
  ('Career Fair 2026', 'Annual career fair with 50+ employers from top tech companies', 'Career', 1, '2026-03-15 09:00:00', '2026-03-15 17:00:00'),
  ('Computer Science Workshop', 'Introduction to Machine Learning and AI fundamentals', 'Workshop', 2, '2026-03-20 14:00:00', '2026-03-20 16:00:00'),
  ('Basketball Tournament', 'Inter-department basketball competition finals', 'Sports', 3, '2026-03-25 10:00:00', '2026-03-25 15:00:00'),
  ('Cultural Festival', 'Annual cultural celebration with performances and food', 'Cultural', 4, '2026-04-01 12:00:00', '2026-04-01 20:00:00'),
  ('Tech Conference 2026', 'Leading industry experts discuss emerging technologies', 'Conference', 5, '2026-04-10 08:00:00', '2026-04-10 18:00:00');
