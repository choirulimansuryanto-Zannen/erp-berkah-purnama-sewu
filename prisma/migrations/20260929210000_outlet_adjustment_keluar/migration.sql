-- Inventory Sheet's new "Barang Keluar" (mutasi keluar) column — a 4th
-- OutletAdjustment type alongside Rusak/Reject/Selisih, but not a loss
-- (excluded from the Adjustment Sheet's loss total).
ALTER TYPE "OutletAdjustmentType" ADD VALUE 'KELUAR';
