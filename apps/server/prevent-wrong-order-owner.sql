-- =====================================================
-- DATABASE TRIGGER TO PREVENT WRONG ORDER OWNERSHIP
-- =====================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS check_order_owner_before_insert;

-- Create trigger to validate order ownership before insert
DELIMITER //
CREATE TRIGGER check_order_owner_before_insert
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
    DECLARE user_role VARCHAR(20);
    
    -- Get the role of the user being assigned to the order
    SELECT role INTO user_role 
    FROM users 
    WHERE id = NEW.user_id;
    
    -- If user doesn't exist or is not a buyer, prevent the insert
    IF user_role IS NULL OR user_role != 'buyer' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Orders can only be assigned to buyers. User must have role = "buyer"';
    END IF;
END//
DELIMITER ;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS check_order_owner_before_update;

-- Create trigger to validate order ownership before update
DELIMITER //
CREATE TRIGGER check_order_owner_before_update
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
    DECLARE user_role VARCHAR(20);
    
    -- Only check if user_id is being changed
    IF NEW.user_id != OLD.user_id THEN
        -- Get the role of the user being assigned to the order
        SELECT role INTO user_role 
        FROM users 
        WHERE id = NEW.user_id;
        
        -- If user doesn't exist or is not a buyer, prevent the update
        IF user_role IS NULL OR user_role != 'buyer' THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Orders can only be assigned to buyers. User must have role = "buyer"';
        END IF;
    END IF;
END//
DELIMITER ;

-- =====================================================
-- ADDITIONAL SAFETY MEASURES
-- =====================================================

-- Create a view to easily identify any problematic orders
CREATE OR REPLACE VIEW problematic_orders AS
SELECT 
    o.id as order_id,
    o.order_number,
    o.user_id,
    u.name as user_name,
    u.email as user_email,
    u.role as user_role,
    o.created_at
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE u.role != 'buyer';

-- Create a stored procedure to fix any existing problematic orders
DELIMITER //
CREATE PROCEDURE FixProblematicOrders()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE order_id INT;
    DECLARE user_id INT;
    DECLARE order_cursor CURSOR FOR 
        SELECT o.id, o.user_id 
        FROM orders o 
        JOIN users u ON o.user_id = u.id 
        WHERE u.role != 'buyer';
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN order_cursor;
    
    read_loop: LOOP
        FETCH order_cursor INTO order_id, user_id;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Log the problematic order
        INSERT INTO system_logs (message, created_at) 
        VALUES (CONCAT('Problematic order detected: Order ', order_id, ' assigned to user ', user_id, ' (non-buyer)'), NOW());
        
        -- Note: In a real scenario, you might want to assign to a default buyer or mark as invalid
        -- For now, we'll just log it
        SELECT CONCAT('Order ', order_id, ' needs manual review - assigned to non-buyer user ', user_id) as warning;
        
    END LOOP;
    
    CLOSE order_cursor;
END//
DELIMITER ;

-- Create a system_logs table if it doesn't exist (for tracking issues)
CREATE TABLE IF NOT EXISTS system_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at)
);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Query to check for any existing problematic orders
SELECT 
    'CURRENT PROBLEMATIC ORDERS' as check_type,
    COUNT(*) as count
FROM problematic_orders;

-- Query to verify triggers are working
SELECT 
    'TRIGGERS STATUS' as check_type,
    TRIGGER_NAME,
    EVENT_MANIPULATION,
    EVENT_OBJECT_TABLE
FROM information_schema.TRIGGERS 
WHERE TRIGGER_SCHEMA = DATABASE() 
AND EVENT_OBJECT_TABLE = 'orders';

-- =====================================================
-- USAGE INSTRUCTIONS
-- =====================================================

/*
TO USE THIS PROTECTION SYSTEM:

1. Run this script to create the triggers and safety measures
2. The triggers will automatically prevent any orders from being assigned to non-buyers
3. Use the view 'problematic_orders' to check for any existing issues
4. Use the procedure 'FixProblematicOrders()' to identify and log problematic orders

EXAMPLE QUERIES:
-- Check for problematic orders
SELECT * FROM problematic_orders;

-- Run the fix procedure
CALL FixProblematicOrders();

-- Check system logs
SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 10;
*/ 