-- Simple update to set super settings
-- First check if columns exist and update

-- Update venue pay configs
UPDATE venue_pay_configs 
SET super_enabled = true,
    super_rate = 0.115
WHERE id IS NOT NULL;

-- Update users
UPDATE users 
SET super_enabled = true 
WHERE id IS NOT NULL;
