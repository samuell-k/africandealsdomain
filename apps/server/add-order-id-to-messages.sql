-- Add order_id column to messages table
ALTER TABLE messages ADD COLUMN order_id INT NULL AFTER product_id;

-- Add foreign key constraint
ALTER TABLE messages ADD CONSTRAINT fk_messages_order 
FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- Add index for order_id
ALTER TABLE messages ADD INDEX idx_order (order_id);

-- Update existing messages to have order_id if they have product_id
-- This is optional and can be run if needed
-- UPDATE messages m 
-- JOIN products p ON m.product_id = p.id 
-- JOIN order_items oi ON p.id = oi.product_id 
-- SET m.order_id = oi.order_id 
-- WHERE m.order_id IS NULL; 