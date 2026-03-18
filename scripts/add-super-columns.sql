-- Add super fields to venue_pay_configs table
ALTER TABLE venue_pay_configs 
ADD COLUMN IF NOT EXISTS super_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS super_rate DECIMAL(5, 4) DEFAULT 0.115;

-- Add super fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS super_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS custom_super_rate DECIMAL(5, 4),
ADD COLUMN IF NOT EXISTS super_fund_abn VARCHAR(50),
ADD COLUMN IF NOT EXISTS super_fund_member_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS super_fund_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS super_fund_usi VARCHAR(50);

-- Add super fields to rosters table
ALTER TABLE rosters 
ADD COLUMN IF NOT EXISTS published_super_rate DECIMAL(5, 4),
ADD COLUMN IF NOT EXISTS total_gross_pay DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS total_super_pay DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12, 2);

-- Update existing records with default values
UPDATE venue_pay_configs 
SET super_enabled = true, super_rate = 0.115 
WHERE super_enabled IS NULL OR super_rate IS NULL;

UPDATE users 
SET super_enabled = true 
WHERE super_enabled IS NULL;
