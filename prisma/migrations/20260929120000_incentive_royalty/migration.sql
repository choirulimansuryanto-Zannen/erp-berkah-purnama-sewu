-- Adds ROYALTY as an 11th IncentiveRuleType (outlet-scope, reuses the same
-- rate-table engine as the 10 incentive types).

-- AlterEnum
ALTER TYPE "IncentiveRuleType" ADD VALUE 'ROYALTY';
