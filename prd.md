# 🏢 ENTERPRISE RESOURCE PLANNING (ERP) SYSTEM
## PRODUCT REQUIREMENTS DOCUMENT (PRD)
### PT BERKAH PURNAMA SEWU - Multi-Divisi Operations

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Target Release**: Phase 1 (Q1 2025), Phase 2 (Q2 2025)

---

## 📋 TABLE OF CONTENTS

1. [Executive Overview](#executive-overview)
2. [System Architecture](#system-architecture)
3. [Database Design](#database-design)
4. [User Roles & Permissions](#user-roles--permissions)
5. [Feature Specifications](#feature-specifications)
6. [User Interface Structure](#user-interface-structure)
7. [API Specifications](#api-specifications)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Technical Stack](#technical-stack)
10. [Security & Compliance](#security--compliance)

---

## 🎯 EXECUTIVE OVERVIEW

### **Product Vision**
Build a unified, system-driven Business Operating System that enables:
- ✅ Real-time operational visibility across 63 outlets
- ✅ Automated reconciliation & variance detection
- ✅ Single source of truth for all divisions
- ✅ Scalable to 100+ outlets within 12 months
- ✅ Measurable KPIs with decision-speed <2 hours

### **Business Objectives**
1. **Reduce Manual Work**: From 8 hours/day manual reconciliation → 30 minutes automated
2. **Improve Data Quality**: From 92% accuracy → 99.5% through validation rules
3. **Faster Decision Making**: From 24-hour report lag → real-time dashboards
4. **Eliminate Silos**: Integrated data across Sales, Ops, HRGA, FA, Marketing
5. **Scale Efficiency**: Support 3x outlet growth without proportional cost increase

### **Key Performance Indicators (Phase 1 Success Criteria)**

| **KPI** | **Baseline** | **Target (Phase 1)** | **Target (Phase 2)** |
|--------|----------|-------------------|-------------------|
| System Uptime | N/A | 99.5% | 99.9% |
| Data Entry Error Rate | 8% | <1% | <0.5% |
| Report Reconciliation Time | 8 hours | 30 minutes | <10 minutes (auto) |
| User Adoption Rate | 0% | >85% | >95% |
| Decision Cycle Speed | 24+ hours | <2 hours | <30 minutes |
| Data Accuracy (KPI) | 92% | 99%+ | 99.5%+ |

---

## 🏗️ SYSTEM ARCHITECTURE

### **High-Level Architecture Diagram**

```
┌────────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                         │
│  (Next.js Frontend + React Components + TailwindCSS)         │
│                                                               │
│  ┌─────────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐  │
│  │  Web App    │ │Mobile App│ │ Landing│ │Master Admin  │  │
│  │ (Dashboard) │ │(Pramuniaga)Page  │  │ Panel        │  │
│  └─────────────┘ └──────────┘ └────────┘ └──────────────┘  │
└──────────────────────────┬────────────────────────────────────┘
                         │
┌──────────────────────────┼────────────────────────────────────┐
│                    API LAYER                                  │
│  (RESTful API + WebSockets for Real-time)                   │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │Auth API  │ │Sales API │ │Ops API   │ │Report API    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │Attendance│ │Inventory │ │Finance   │ │Reconciliation│   │
│  │API       │ │API       │ │API       │ │Engine        │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
└──────────────────────────┬────────────────────────────────────┘
                         │
┌──────────────────────────┼────────────────────────────────────┐
│               BUSINESS LOGIC LAYER                            │
│  (Next.js Server-side Functions + Middleware)               │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Transaction Processing │ Validation Rules │ Scheduling │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────┬────────────────────────────────────┘
                         │
┌──────────────────────────┼────────────────────────────────────┐
│                   DATA LAYER                                  │
│  (Supabase PostgreSQL + Redis Cache)                        │
│                                                               │
│  ┌──────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │Core Database   │  │Audit Trail DB│  │Cache (Redis)    │ │
│  │(PostgreSQL)    │  │(Immutable)   │  │(Hot Data)       │ │
│  └──────────────────┘  └──────────────┘  └─────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### **Network Architecture**

```
OUTLETS (63 locations)
    │
    ├── [Pramuniaga Mobile App] → Sync via API
    ├── [SPV Web Dashboard] → Real-time updates
    └── [Offline Queue] → Batch sync when online

HEADQUARTERS (Single Source of Truth)
    │
    ├── [HQ Web Dashboard] → All divisions
    ├── [Master Admin Panel] → System configuration
    └── [Analytics Engine] → Reporting & Insights

INTEGRATIONS (Phase 2)
    │
    ├── [Grab API] → Order sync
    ├── [GoFood API] → Order sync
    ├── [Shopee API] → Order sync
    ├── [Payment Gateway] → Settlement tracking
    └── [Accounting Software] → FA integration
```

---

## 💾 DATABASE DESIGN

### **Core Database Schema (Simplified View)**

```sql
-- MASTER DATA
├── users (id, email, password_hash, role, division, outlet_id, status)
├── outlets (id, name, region, address, manager_id, status)
├── regions (id, name, spv_id, outlets_count)
├── products (id, name, category, price, cost, status)
├── members (id, phone, name, tier, points_balance, created_at)

-- TRANSACTIONAL DATA
├── transactions (id, outlet_id, pramuniaga_id, items[], total, channel, payment_method, created_at)
├── transaction_items (id, transaction_id, product_id, qty, unit_price, discount)
├── attendance_records (id, user_id, outlet_id, time_in, time_out, status, date)
├── attendance_checkpoints (id, user_id, outlet_id, checkpoint_number, timestamp, location_gps)

-- REPORTING & CONTROL
├── daily_reports (id, outlet_id, pramuniaga_id, date, omset, expenses, variance, spv_approval_status)
├── inventory_records (id, outlet_id, date, opening_balance, received, used, rejected, closing_balance)
├── expense_records (id, outlet_id, date, category, amount, description, receipt_url, approval_status)
├── member_transactions (id, member_id, transaction_id, points_earned, points_redeemed)

-- APPROVALS & AUDIT
├── approval_workflows (id, entity_type, entity_id, submitted_by, submitted_at, approved_by, approved_at, status)
├── audit_trail (id, table_name, record_id, action, old_value, new_value, user_id, timestamp)
```

### **Key Design Principles**

1. **Immutability**: Once transaction is finalized, cannot be modified (soft deletes only)
2. **Audit Trail**: Every change logged with user, timestamp, and reason
3. **Normalization**: Avoid data duplication, ensure referential integrity
4. **Scalability**: Indexed on high-query fields (outlet_id, date, user_id)
5. **Partitioning**: Transactions table partitioned by month for performance

---

## 👥 USER ROLES & PERMISSIONS

### **Role Hierarchy & Access Matrix**

```
┌─────────────────────────────────────────────────────────────┐
│                    MASTER ADMIN (CEO Level)                 │
│  • Full system access                                       │
│  • Manage all users & roles                                 │
│  • System configuration & customization                     │
│  • View all reports & analytics                             │
│  • Audit trail access                                       │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼────────────────────┐
        │                   │                   │
    ┌────┴─────┐         ┌────┴─────┐         ┌────┴─────┐
    │DIVISIONAL           │DIVISIONAL           │DIVISIONAL
    │HEADS (5)            │HEADS (5)            │HEADS (5)
    │Sales                │Ops                  │HRGA/FA/
    │ Director            │Director             │Marketing
    └────┬─────┘           └────┬─────┘           └────┬─────┘
         │                     │                     │
    ┌────┴──────┐          ┌────┴──────┐         ┌───┴────┐
    │SPV (8)    │          │Ops Admin  │         │HRGA   │
    │Regional   │          │Warehouse  │         │Admin  │
    │Supervisor │          │Mgmt       │         │(2)    │
    └────┬──────┘          └────┬──────┘         └────────┘
         │                      │
    ┌────┴──────────┐      ┌────┴──────────┐
    │PRAMUNIAGA (150) │    │Ops Field Team │
    │Store Staff     │    │Delivery/Stock │
    └──────────────────┘    └──────────────────┘
```

### **Detailed Permission Matrix**

> ⚠️ **Note added during implementation**: the checkmark cells in this table were corrupted (encoding/mojibake) in the source document supplied for this project and could not be recovered verbatim. The table below has been reconstructed by cross-referencing the per-role module descriptions elsewhere in this document (Modules 1–8) and should be reviewed against the actual business rules before being treated as final. See `src/lib/permissions.ts` for the version currently wired into the codebase.

| **Feature** | **Pramuniaga** | **SPV** | **Ops Admin** | **FA Admin** | **HRGA Admin** | **Marketing Admin** | **Master Admin** |
|-----------|---|---|---|---|---|---|---|
| **ATTENDANCE** |
| Personal Check-in | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Personal History | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Team History | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Approve/Reject Permission | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **SALES/POS** |
| Ring Up Transactions | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View Sales History | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Edit Posted Transactions | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Delete Transactions | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **REPORTING** |
| Submit Daily Report | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Validate Reports | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| View Outlet Reports | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| View Company Reports | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **INVENTORY** |
| Record Stock Adjustment | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Approve Stock Movements | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| View Inventory Reports | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **FINANCE** |
| Submit Expenses | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Approve Expenses | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| View Ledger | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Generate Financial Reports | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **MEMBER MANAGEMENT** |
| Register Members | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| View Member Data | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage Promotions | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **SYSTEM ADMIN** |
| Manage Users | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| System Configuration | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View Audit Trail | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Data Backups | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 📦 FEATURE SPECIFICATIONS

### **MODULE 1: ATTENDANCE & TIME MANAGEMENT**

#### **Pramuniaga Features**
```
1.1 CHECK-IN / CHECK-OUT
├── Auto-detect: Time, GPS location, IP address
├── Photo verification (optional for fraud prevention)
├── Offline mode: Queue locally, sync when online
├── Timestamp accuracy: ±5 seconds
└── Success indicator: Green checkmark + timestamp confirmation

1.2 ATTENDANCE CHECKPOINTS (23x daily)
├── Scheduled times: 09:00, 09:30, 10:00, ... 21:30
├── Manual verification (1-tap completion)
├── Purpose: Operational status check
│   ├── Outlet staffing
│   ├── Customer flow observed
│   ├── POS operational
│   └── Stock sufficient
├── Optional photo/note for anomalies
└── Auto-alert if missed 2+ checkpoints

1.3 OFFLINE/SAKIT PERMISSION
├── Form: Type (OFF/SAKIT) + Date Range + Reason + Attachment
├── Submit to: SPV (immediate notification)
├── SPV approval: Needed before OFF date
├── Auto-coverage assignment: System suggests replacement
└── Notification: Applicant notified of status
```

#### **SPV Features**
```
1.4 TEAM ATTENDANCE OVERVIEW
├── Calendar view: All team members' attendance
├── Metrics: Attendance rate (%), ON-TIME rate (%), ABSENCE rate (%)
├── Heatmap: Most/least compliant team members
├── OFF/SAKIT requests: Pending → Approve/Reject
├── Coverage planning: Assign coverage for OFF dates
└── Alert: Unusual patterns detected (auto-flagged)

1.5 ATTENDANCE VALIDATION
├── Review checkpoint data quality
├── Flag: Missed checkpoints, inconsistent data
├── Action: Send message to pramuniaga for clarification
└── Escalate: Suspicious patterns to HR
```

#### **HRGA Admin Features**
```
1.6 ATTENDANCE POLICY MANAGEMENT
├── Define: Checkpoint times, grace period, late penalty
├── Configure: Paid leave types (annual, sick, bereavement)
├── Audit: Attendance compliance by employee
├── Reports: Monthly/quarterly attendance analytics
└── Alerts: Policy violation threshold management
```

---

### **MODULE 2: SALES & POS SYSTEM**

#### **Pramuniaga POS Interface**
```
2.1 PRODUCT SELECTION
├── Categories:
│   ├── Alacarte (Individual items)
│   ├── Paket MBG (Bundle)
│   ├── Paket KOPDES (Bundle)
│   └── Paket PAHLAWAN (Bundle)
│
├── Search: By product name / SKU / barcode scan
├── Quick buttons: Top 5 best-sellers for speed
└── Product info: Price, available qty, calories (optional)

2.2 TRANSACTION FLOW
├── Step 1: Add items
│   ├── Quantity selection
│   ├── Special instructions (spicy, no ice, etc.)
│   └── Running total display
│
├── Step 2: Apply discounts (if eligible)
│   ├── Promo codes
│   ├── Member discount (auto-calculated by tier)
│   └── Manual discount (SPV approval required if >10%)
│
├── Step 3: Select payment method
│   ├── Cash
│   ├── Cashless (Debit/Credit)
│   ├── Grab Pay / e-Wallet
│   ├── GoFood / Shopee (for online orders)
│   └── Qpon (points redemption)
│
├── Step 4: Member lookup (optional)
│   ├── Search by phone/ID
│   ├── Auto-enroll new member
│   └── Apply member points
│
├── Step 5: Confirmation & Print
│   ├── Receipt preview
│   ├── Print kitchen ticket
│   ├── Print customer receipt (with member points earned)
│   └── Save transaction
│
└── Step 6: Post-transaction
    ├── Success notification
    ├── Suggestion: Upsell item (smart recommendation)
    └── Next customer

2.3 TRANSACTION DATA CAPTURE
├── Immutable record:
│   ├── Transaction ID (auto-generated)
│   ├── Timestamp (accurate to millisecond)
│   ├── Pramuniaga ID
│   ├── Outlet ID
│   ├── Items (with SKU, qty, price)
│   ├── Subtotal, discount, tax, total
│   ├── Payment method
│   ├── Channel (online/offline/walk-in)
│   ├── Member ID (if applicable)
│   ├── Points earned/redeemed
│   └── Device fingerprint (for audit)

2.4 PAYMENT METHOD TRACKING
├── Channel breakdowns:
│   ├── TUNAI (Cash only)
│   ├── NON-TUNAI (Cashless, Grab, GoFood, Shopee, Qpon, TikTok)
│   └── Customer model classification (Online vs Offline)

2.5 REFUND / VOID POLICY
├── Conditions: Return within 30 minutes, receipt shown
├── Approval: SPV must approve (reason recorded)
├── Processing: Auto-reversal, points reversed
└── Tracking: Separate refund ledger (immutable)
```

#### **SPV Sales Dashboard**
```
2.6 SALES OVERVIEW (Real-time)
├── KPI Cards:
│   ├── Today's Omset vs Target Insentif (% achievement)
│   ├── Today's Omset vs Target Fullshift (% achievement)
│   ├── Transaction count (running)
│   ├── Average Order Value (AOV)
│   ├── Member vs Non-member ratio
│   └── Pace vs 8-hour target (projected daily omset)
│
├── Sales Breakdown:
│   ├── By Channel (Cash, Cashless, Grab, GoFood, Shopee, Qpon, TikTok)
│   ├── By Product Category (Alacarte, Paket MBG, KOPDES, PAHLAWAN)
│   ├── By Pramuniaga (individual performance)
│   └── By Shift (Shift 1, Shift 2, Fullshift)
│
└── Charts:
    ├── Hourly omset trend
    ├── Channel mix (pie chart)
    └── Top products (bar chart)

2.7 OUTLET PERFORMANCE DASHBOARD
├── Metrics (each outlet in region):
│   ├── Today's omset
│   ├── Target achievement %
│   ├── Week-to-date trend
│   ├── Comparison to last week (%)
│   └── Ranking (best to worst)
│
├── Alerts:
│   ├── Red: Outlet omset <70% target pace
│   ├── Yellow: Outlet omset 70-90% target pace
│   └── Green: Outlet omset >90% target pace
│
└── Actions:
    ├── Click outlet → Detailed transaction review
    ├── View pramuniaga performance
    └── Send message to team
```

---

### **MODULE 3: INVENTORY & STOCK MANAGEMENT**

#### **Pramuniaga Stock Recording**
```
3.1 DAILY STOCK CHECK
├── Opening Balance (from yesterday's closing)
├── + Received Goods (log with receiving ticket)
├── - Used/Sold Items (auto-sync from POS)
├── - Rejected Items (damage/expired, with photo)
├── = Closing Balance (manual count, then verify against system)
│
├── Variance Analysis:
│   ├── If Closing = System Balance → ✅ Reconciled
│   ├── If Closing ≠ System Balance → ⚠️ Variance flagged
│   │   ├── Photo proof required
│   │   ├── Explanation required
│   │   └── Alert to SPV
│   └── Tolerance: ±5% or ±5 units (configurable)

3.2 STOCK ADJUSTMENT REQUEST
├── When: Found theft, damage, expiration
├── Form: Category + Quantity + Reason + Photo
├── Submit to: SPV for approval
└── Approval flow:
    ├── SPV review + verify photo
    ├── If approved → System balance updated, immutable record created
    └── If rejected → Reason returned to pramuniaga
```

#### **SPV Inventory Dashboard**
```
3.3 REGIONAL STOCK OVERVIEW
├── Consolidated stock status:
│   ├── All outlets in region (matrix view)
│   ├── By product category
│   ├── Variance tracking (stock level vs system)
│   └── Reorder alerts (stock <20% min level)

3.4 INVENTORY AUDIT
├── Review daily stock checks
├── Approve/reject stock adjustments
├── Spot-check: Random outlet on specific date
└── Escalate: High variance outlets (>10%) to warehouse

3.5 STOCK HISTORY
├── View 30-day stock transactions per outlet
├── Trend analysis: Usage pattern per product
├── Forecast: Predicted stock-out date
└── Recommendation: Reorder quantity
```

#### **Operasional Admin Warehouse Management**
```
3.6 WAREHOUSE INVENTORY SYSTEM
├── Central warehouse stock tracking
├── Receiving goods (from supplier, log lot number/expiry)
├── Distribution to outlets (assign lots to outlets)
├── Cycle count (monthly, by product)
└── Reorder management (auto-generate PO when stock <min level)

3.7 OUTLET STOCK REQUESTS
├── Outlets submit stock requests (app notification)
├── Warehouse approve/partial approve/deny with reason
├── Delivery scheduling (track ETA)
└── Delivery confirmation (outlet receives, signs, system updates)

3.8 EXPIRY DATE TRACKING
├── All stock has lot number + expiry date
├── Alert: 30 days before expiry
└── Report: Expired stock by outlet (for destruction tracking)
```

---

### **MODULE 4: FINANCIAL TRACKING & RECONCILIATION**

#### **Pramuniaga Daily Report Submission**
```
4.1 DAILY OUTLET REPORT
├── Fields to fill:
│   ├── Omset Outlet (auto-populated from POS)
│   ├── Penjualan Non-Tunai (auto-calculated from channels)
│   ├── Potongan Penjualan (discounts, auto-populated)
│   ├── Pengeluaran Operasional Outlet (expenses logged)
│   ├── Actual Cash Counted (manual input)
│   └── Notes (if variance detected)
│
├── Auto-calculation:
│   Summary Setoran = Omset - Non-Tunai - Potongan - Expenses
│   Example: 5M - 2M - 0.5M - 0.3M = 2.2M (NET CASH due)
│
├── Variance Detection:
│   Expected Cash = Summary Setoran (system calculated)
│   Actual Cash = Physical count (pramuniaga input)
│   Variance = Actual - Expected
│   │
│   ├── If |Variance| ≤ Rp 10,000 → ✅ Approved (auto)
│   ├── If Rp 10k < |Variance| ≤ Rp 50k → ⚠️ SPV review required
│   └── If |Variance| > Rp 50k → 🔴 ESCALATE + Photo proof required
│
└── Submission:
    ├── Digital signature / biometric verification
    ├── Timestamp recorded
    ├── Cannot edit after submission
    └── Notification to SPV (auto)

4.2 EXPENSE TRACKING (Outlet-level)
├── Categories:
│   ├── Supplies (cleaning, packaging, etc.)
│   ├── Maintenance (repair, cleaning service)
│   ├── Utilities (electricity, water - if outlet-managed)
│   ├── Marketing (local promo materials)
│   └── Other (with explanation)
│
├── Entry process:
│   ├── Date + Category + Description + Amount
│   ├── Receipt/photo attachment (required)
│   ├── Save as draft or submit
│   └── (If <Rp 500k: auto-approved; >500k: needs SPV approval)
│
└── Monthly expense summary (auto-generated)
```

#### **SPV Financial Review Dashboard**
```
4.3 OUTLET DAILY RECONCILIATION
├── View pramuniaga reports:
│   ├── Omset: ✓ System verified
│   ├── Expenses: Validate attached receipts
│   ├── Variance: Review explanation if any
│   ├── Stock: Cross-check with inventory report
│   └── Workflow: Approve / Reject / Request Revision
│
└── Approval workflow:
    ├── Status: Pending → Approved/Rejected/Revision
    ├── Timeline: Must review within 24 hours (SLA)
    ├── Notes: Add comments/coaching notes
    └── Audit trail: All approvals logged

4.4 REGION FINANCIAL SUMMARY
├── Consolidated view:
│   ├── Total region omset (all outlets)
│   ├── Total non-tunai breakdown by channel
│   ├── Total expenses (by category)
│   ├── Total net setoran
│   └── vs weekly/monthly target
│
├── Variance analysis:
│   ├── Outlets with cash variance >Rp 100k
│   ├── Outlets with unusually high expenses
│   ├── Outlets with low omset (trend analysis)
│   └── Outliers flagged for investigation
│
└── Export: Regional summary (PDF/Excel)
```

#### **FA Company-Level Financial Management**
```
4.5 COMPANY-WIDE FINANCIAL DASHBOARD
├── KPI Summary:
│   ├── Total company omset (all outlets, all channels)
│   ├── Revenue by division (Sales, Ops, etc.)
│   ├── Profitability by outlet
│   ├── Gross margin trending
│   └── Variance % (actual vs budget)
│
├── Channel Performance:
│   ├── Cash vs Cashless mix (%)
│   ├── Online channels (Grab, GoFood, Shopee, TikTok) contribution
│   └── Trend: Channel shift over time
│
├── Cost Analysis:
│   ├── Cost of Goods Sold (COGS)
│   ├── Operational Expenses (by category)
│   ├── Labor Cost (via HR integration)
│   └── Total operating margin %
│
└── Forecasting:
    ├── 7-day, 30-day revenue forecast
    ├── Seasonality adjusted
    └── Variance prediction
```

---

### **MODULE 5: ATTENDANCE & LEAVE MANAGEMENT**

#### **All Users - Personal Attendance**
```
5.1 SELF-SERVICE CHECK-IN/OUT
├── Mobile app button: BIG CHECK-IN / CHECK-OUT
├── Auto-capture: Time, GPS location, IP
├── Confirmation: Visual + haptic feedback
├── History: Personal attendance calendar (view only)
└── Integration: Auto-sync to HRGA system
```

#### **SPV/Office Staff - Team Attendance**
```
5.2 TEAM ATTENDANCE MANAGEMENT
├── View: All team members' daily attendance
├── Approve: OFF/Sakit requests
├── Escalate: Unusual patterns to HRGA
└── Report: Monthly attendance compliance
```

#### **HRGA Admin - Full Attendance Control**
```
5.3 HRGA ATTENDANCE SYSTEM
├── Policy configuration:
│   ├── Checkpoint times (09:00, 09:30, etc.)
│   ├── Grace period (5, 10, or 15 minutes)
│   ├── Penalty for late/absent
│   └── Paid leave entitlements (annual, sick, personal)
│
├── Leave type management:
│   ├── Annual leave (configurable days per tier)
│   ├── Sick leave (requires attachment after 2 days)
│   ├── Personal leave (max 3 days/year)
│   ├── Bereavement (with documentation)
│   └── Unpaid leave (manual approval)
│
├── Approval workflows:
│   ├── Employee submit request
│   ├── SPV/Manager approve (if <5 days)
│   ├── HRGA approve (if >5 days or sensitive)
│   └── Auto-reject if exceeds entitlement
│
├── Reporting:
│   ├── Monthly attendance report (by employee, division)
│   ├── Compliance scorecard (attendance % vs policy)
│   ├── High absentee alert (auto-triggered at >15% absence)
│   └── Audit trail (who approved/rejected what)
│
└── Integration: Feeds to payroll (for deduction calculation)
```

---

### **MODULE 6: MEMBER & LOYALTY PROGRAM**

#### **Pramuniaga - Member Management**
```
6.1 MEMBER REGISTRATION
├── At checkout: Auto-prompt if new customer
├── Quick entry: Phone + Name (1 field)
├── Or: Scan ID / Search existing member
└── Tier assignment: Auto-based on first purchase
    ├── Bronze (0-Rp 500k annual spend)
    ├── Silver (Rp 500k-2M annual spend)
    └── Gold (>Rp 2M annual spend)

6.2 POINTS SYSTEM
├── Earning: Rp 1 spent = 1 point (configurable)
├── Tier bonus:
│   ├── Bronze: 1x
│   ├── Silver: 1.2x
│   └── Gold: 1.5x
│
├── Redemption:
│   ├── 100 points = Rp 10,000 discount
│   ├── One-tap redemption at checkout
│   ├── Auto-deduct from balance
│   └── Receipt shows points remaining
│
└── Fraud prevention:
    ├── Duplicate entry detection (same phone, same time)
    ├── Suspicious pattern alert (abnormal point accumulation)
    └── Manual review required if flagged
```

#### **SPV/Marketing - Member Analytics**
```
6.3 MEMBER DASHBOARD
├── Metrics:
│   ├── Total members (region/outlet)
│   ├── Active vs inactive (90-day rule)
│   ├── Tier distribution (Bronze/Silver/Gold)
│   ├── Lifetime value (LTV) per member
│   ├── Repeat purchase rate %
│   └── Member omset % (contribution to total sales)
│
├── Member lists:
│   ├── Search by phone/ID
│   ├── View purchase history
│   ├── Points balance & expiry (if applicable)
│   ├── Tier status
│   └── Preferred products
│
└── Actions:
    ├── Send promotional message (SMS/App)
    ├── Manual point adjustment (requires approval)
    └── Tier upgrade/downgrade (manual override)
```

#### **Marketing - Campaign Management**
```
6.4 LOYALTY CAMPAIGN PLANNING
├── Promotion setup:
│   ├── Campaign name, dates, target member tier
│   ├── Bonus points: "Spend Rp 100k, earn 2x points"
│   ├── Discount offer: "Members get 15% off"
│   ├── Product focus: "Buy 3 Paket MBG, get points"
│   └── Budget cap (if any)
│
├── Execution:
│   ├── System auto-applies on checkout
│   ├── Customer sees benefit in real-time
│   ├── Receipt highlights promotion
│   └── Marketing gets notification of redemption
│
└── Performance tracking:
    ├── Total points distributed in campaign
    ├── Omset uplift vs baseline
    ├── Member tier migration (Bronze→Silver, etc.)
    └── ROI calculation
```

---

### **MODULE 7: REPORTING & ANALYTICS**

#### **SPV Regional Reports**
```
7.1 OUTLET-LEVEL REPORTS
├── Daily Report:
│   ├── Omset, transactions, AOV
│   ├── Variance (cash, inventory)
│   ├── Expenses (by category)
│   └── Attendance (check-in rate %)
│
├── Weekly Summary:
│   ├── Trend vs last week
│   ├── Best/worst days
│   ├── Product performance
│   └── Channel performance
│
└── Monthly Performance:
    ├── Month-to-date omset vs target
    ├── Achievement % (target omset, target fullshift)
    ├── Outlet ranking vs region
    └── Expense variance analysis

7.2 REGIONAL PERFORMANCE
├── Region-wide KPI:
│   ├── Total omset (all outlets)
│   ├── Target achievement %
│   ├── Channel mix
│   ├── Product performance
│   ├── Expense ratio (expenses / omset)
│   └── Net margin %
│
├── Outlet ranking:
│   ├── Top 3 performing outlets
│   ├── Bottom 3 performing outlets
│   ├── Trend: Improving vs Declining
│   └── Peer comparison (similar outlet type)
│
└── Data quality:
    ├── Report submission rate (%)
    ├── Data accuracy score
    ├── Variance resolution rate
    └── Escalation frequency
```

#### **CEO/Executive Dashboard**
```
7.3 COMPANY-WIDE EXECUTIVE DASHBOARD
├── Real-time KPI Cards:
│   ├── Today's Total Omset (all 63 outlets)
│   ├── vs Target Achievement %
│   ├── Week-to-date vs Budget
│   ├── Month-to-date vs Target
│   ├── Channel mix (Tunai vs Non-Tunai)
│   └── Member omset contribution %
│
├── Performance by Region:
│   ├── Ranked leaderboard (8 regions)
│   ├── Omset trend (line chart)
│   ├── Variance heatmap (color-coded by variance %)
│   └── Profitability (gross margin %)
│
├── Business Intelligence:
│   ├── Product performance (top 20 SKUs)
│   ├── Customer segments (member vs non-member, tier breakdown)
│   ├── Seasonality trends (weekly/monthly patterns)
│   ├── Demand forecast (next 7/30 days)
│   └── Competitive benchmarking (if applicable)
│
├── Operational Health:
│   ├── Data quality score (accuracy, timeliness)
│   ├── System uptime %
│   ├── Average report validation time
│   └── Anomaly alerts (auto-flagged)
│
└── Financial Summary:
    ├── Revenue by division
    ├── Profit by outlet
    ├── Expense variance (vs budget)
    ├── Cash flow status
    └── Forecast vs actuals
```

---

### **MODULE 8: SYSTEM ADMINISTRATION & CONFIGURATION**

#### **Master Admin Panel**
```
8.1 USER MANAGEMENT
├── Create/Edit/Deactivate users:
│   ├── Employee data (name, ID, phone, email)
│   ├── Role assignment (Pramuniaga, SPV, Ops, HRGA, FA, Marketing)
│   ├── Division assignment
│   ├── Outlet assignment (for outlet-based users)
│   ├── Access level (what modules can access)
│   └── Status (Active/Inactive/Suspended)
│
├── Bulk import:
│   ├── Upload CSV with employee list
│   ├── Auto-create accounts, assign roles
│   └── Send welcome email with temporary password
│
└── Password management:
    ├── Force password reset (if compromised)
    ├── Password expiry policy (30/60/90 days)
    └── 2FA (two-factor authentication) enforcement

8.2 PRODUCT & MENU MANAGEMENT
├── Product master:
│   ├── Add/Edit SKU, name, category, price
│   ├── Cost tracking (for margin calculation)
│   ├── Outlet availability (all outlets vs selective)
│   ├── Bundle management (Paket MBG, KOPDES, PAHLAWAN)
│   └── Status (Active/Inactive/Seasonal)
│
└── Pricing strategy:
    ├── Base price vs promotional price
    ├── Tier-based pricing (if applicable)
    ├── Channel-specific pricing (online vs offline)
    └── Date-range based pricing (seasonal)

8.3 OUTLET CONFIGURATION
├── Outlet master:
│   ├── Name, address, region assignment
│   ├── Manager/SPV assignment
│   ├── Operating hours
│   ├── Staffing (pramuniaga count by shift)
│   ├── Product range (which products available)
│   └── Omset target (daily, weekly, monthly)
│
└── Outlet-specific settings:
    ├── Receipt printer configuration
    ├── Kitchen display system (KDS) settings
    ├── Payment method acceptance (which channels)
    └── Member program eligibility

8.4 BUSINESS RULES & WORKFLOWS
├── Approval workflows:
│   ├── Define who approves expenses (amount-based)
│   ├── Define who approves variance >threshold
│   ├── Define who approves stock adjustments
│   └── SLA for approvals (e.g., 24 hours)
│
├── Alert configuration:
│   ├── Variance threshold (Rp 50k default)
│   ├── Omset variance (10% default)
│   ├── Low stock alert (20% min level)
│   ├── Absent employee alert (>3 days)
│   └── Report submission SLA (23:00 deadline)
│
└── Reconciliation engine:
    ├── Auto-match POS omset to reported omset
    ├── Auto-calculate cash discrepancy
    ├── Flag for manual review if variance
    └── Generate reconciliation report

8.5 AUDIT & COMPLIANCE
├── Audit trail:
│   ├── View all system changes (who, what, when)
│   ├── Filter by user, module, date range
│   ├── Export audit log (for compliance)
│   └── Retention: Minimum 2 years
│
├── Data backup:
│   ├── Daily backup (automated)
│   ├── Backup retention (30-day rolling)
│   ├── Disaster recovery plan (RTO <4 hours)
│   └── Test restore quarterly
│
└── Security audit:
    ├── Login attempts (flag suspicious activity)
    ├── Data access logs (who accessed what)
    ├── Permission changes (track privilege escalation)
    └── System health (performance, errors)

8.6 SYSTEM SETTINGS
├── Company information:
│   ├── Name, logo, branding
│   ├── Receipt format customization
│   └── Report templates
│
├── Financial settings:
│   ├── Fiscal year start date
│   ├── Currency (IDR default)
│   ├── Tax rate
│   └── Rounding rule
│
└── Operational settings:
    ├── Business hours (default, per outlet override)
    ├── Shift times (Shift 1, Shift 2, Fullshift)
    ├── Checkpoint frequency (23x daily)
    └── Grace period for attendance
```

---

## 🎨 USER INTERFACE STRUCTURE

### **Navigation Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                    HEADER                               │
│  Logo | Search | Notifications | User Profile | Logout │
└─────────────────────┬─────────────────────────────────────┘
                     │
        ┌─────────────┴─────────────┐
        │                         │
    ┌────┴────────┐        ┌──────┴────────┐
    │ SIDEBAR    │        │ MAIN CONTENT  │
    │ (Collapsible)│        │ (Dynamic)    │
    │            │        │              │
    │ • Dashboard│        │  Page Title  │
    │ • Sales    │        │  Breadcrumbs │
    │ • Inventory│        │  Content     │
    │ • Reports  │        │  Footer      │
    │ • Attendance       │              │
    │ • Members  │        │              │
    │ • Settings│        │              │
    └────────────┘        └────────────────┘
```

### **Page Structure by Role**

#### **PRAMUNIAGA Mobile App**
```
TAB 1: HOME DASHBOARD
├── Quick Stats (Today)
│   ├── Omset | Transactions | AOV | Members
│   ├── Target Achievement % (Insentif, Fullshift)
│   └── Running pace indicator
├── Quick Actions
│   ├── [BIG CHECK-IN BUTTON] (if not checked in)
│   ├── [BIG CHECK-OUT BUTTON] (if checked in)
│   ├── [POS] (take order)
│   ├── [CHECKPOINT] (23x daily)
│   └── [SUBMIT REPORT] (at end of day)
└── Recent Transactions (carousel, 5 last)

TAB 2: POS / KASIR
├── Category tabs (Alacarte, Paket MBG, KOPDES, PAHLAWAN)
├── Product list (image, name, price)
├── Add to cart (bottom sheet)
├── Payment method selection
├── Member lookup
└── Confirm & print

TAB 3: TODAY'S SUMMARY
├── Omset breakdown (by channel, by product, by time)
├── Transaction list (clickable for detail)
├── Expenses logged
├── Stock check status
└── Report status (submitted/pending/approved)

TAB 4: PROFILE
├── Personal info
├── Attendance calendar
├── Salary/bonus status
├── Notifications
└── Settings
```

#### **SPV Web Dashboard**
```
SIDEBAR MENU:
├ 📊 Dashboard
├ 🏪 Outlets (all outlets under SPV)
├ 👥 Team
├ 📋 Reports
├ 📈 Analytics
├ ✓ Validations (pending approvals)
├ ⚙ Settings
└ Logout

MAIN AREA:
┌────────────────────────────────────┐
│ SPV DASHBOARD                     │
├────────────────────────────────────┤
│ Region: [Select] | Date: Today    │
│                                   │
│ KPI Cards:                        │
│ ┌─────────┬─────────┬─────────┐  │
│ │Region   │ Weekly  │ Monthly │  │
│ │Omset    │ Target  │ Target  │  │
│ │Rp ___M  │ 85%     │ 92%     │  │
│ └─────────┴─────────┴─────────┘  │
│                                   │
│ Outlet Status Matrix:             │
│ ┌───────────────────────────────┐  │
│ │Outlet │ Today │ Target │ Var │  │
│ ├───────────────────────────────┤  │
│ │OUT-1  │500k  │ 90%    │+20% │  │
│ │OUT-2  │420k  │ 75%    │-15% │  │
│ │OUT-3  │380k  │ 68%    │-22% │  │
│ └───────────────────────────────┘  │
│                                   │
│ Pending Validations:              │
│ ┌───────────────────────────────┐  │
│ │5 Daily Reports awaiting     │  │
│ │approval                     │  │
│ └───────────────────────────────┘  │
└────────────────────────────────────┘

OUTLET DETAIL PAGE:
├ Outlet name, address
├ Pramuniaga list (with today's performance)
├ Daily report (submitted/pending/approved)
├ Transaction list (hourly breakdown)
├ Stock summary
└ Variance alerts (if any)
```

#### **CEO/Executive Dashboard**
```
SIDEBAR MENU:
├ 📊 Dashboard (Executive KPI)
├ 📈 Performance (by region, by outlet)
├ 📉 Analytics (trends, forecasts)
├ 💰 Financial (revenue, expenses, margin)
├ 👥 People (HR data, attendance)
├ 🎯 Operations (inventory, logistics)
├ 📣 Marketing (campaigns, member data)
├ 🔍 Intelligence (anomaly alerts, insights)
├ ⚙ System (admin, audit trail)
└ Logout

MAIN DASHBOARD:
┌────────────────────────────────────────┐
│ EXECUTIVE OVERVIEW                   │
├────────────────────────────────────────┤
│                                      │
│ KPI Summary (Real-time):             │
│ ┌───────────────────────────────────┐ │
│ │ Today's Omset (All 63 Outlets) │ │
│ │ Rp 125,450,000                  │ │
│ │ vs Target: 94% ✓ ON TRACK       │ │
│ │ Week-to-date: Rp 687,320,000    │ │
│ │ Month-to-date: Rp 3,412,000,000 │ │
│ └───────────────────────────────────┘ │
│                                      │
│ Regional Performance:                │
│ ┌─────────────────────────────────────┐
│ │ Region    │ Omset  │ Target │ %  │┤
│ ├─────────────────────────────────────┤│
│ │Cilegon   │15.2M  │ 16.5M  │92% │┤
│ │Karawaci  │14.8M  │ 16.0M  │92% │┤
│ │Serang    │14.1M  │ 15.0M  │94% │┤
│ │Ciledug   │13.9M  │ 14.8M  │94% │┤
│ │Balaraja  │ 9.2M  │ 10.0M  │92% │┤
│ │Tangsel   │18.5M  │ 18.0M  │103%│┤
│ │Bekasi    │19.9M  │ 19.5M  │102%│┤
│ │Jakbar    │ 4.1M  │ 4.2M   │98% │┤
│ └─────────────────────────────────────┘
│                                      │
│ Channel Mix (Today):                 │
│ ┌─────────────────────────────────────┐
│ │ Tunai (Cash): 45%    █████       │┤
│ │ Non-Tunai: 55%       ██████      │┤
│ │   ├── Cashless: 25%   ████         │┤
│ │   ├── Grab: 15%       ███          │┤
│ │   ├── GoFood: 10%     ██           │┤
│ │   └── Shopee/Others: 5%█          │┤
│ └─────────────────────────────────────┘
│                                      │
│ Alerts & Anomalies:                  │
│ ┌─────────────────────────────────────┐
│ │ 🔴 3 outlets below 80% target    │┤
│ │ 🟡 12 outlets 80-90% target      │┤
│ │ 🟢 48 outlets >90% target        │┤
│ │                                  │┤
│ │ ⚠️ High variance (>5%):          │┤
│ │   • OUT-SERANG-03: +12% variance │┤
│ │   • OUT-KARWA-07: -8% variance   │┤
│ └─────────────────────────────────────┘
└────────────────────────────────────────┘
```

---

## 🔌 API SPECIFICATIONS

### **Core API Endpoints (RESTful)**

#### **Authentication**
```
POST /api/v1/auth/login
├ Request: { email, password }
└ Response: { token, user, role, permissions }

POST /api/v1/auth/logout
POST /api/v1/auth/refresh-token
POST /api/v1/auth/forgot-password
```

#### **Attendance**
```
POST /api/v1/attendance/check-in
├ Request: { user_id, outlet_id, gps_location, photo_url? }
└ Response: { success, timestamp, status }

POST /api/v1/attendance/check-out
└ Response: { success, total_hours, status }

POST /api/v1/attendance/checkpoint
├ Request: { user_id, checkpoint_number, status, notes? }
└ Response: { success, timestamp }

GET /api/v1/attendance/my-records?date_from=&date_to=
└ Response: [{ date, check_in, check_out, duration, status }]

GET /api/v1/attendance/team?region_id=
└ Response (SPV): [{ user_id, name, today_status, week_data }]
```

#### **POS / Sales**
```
POST /api/v1/transactions/create
├ Request:
│  {
│    outlet_id, pramuniaga_id, items: [{ product_id, qty }],
│    discount, payment_method, member_id?, notes?
│  }
└ Response: { transaction_id, success, receipt_url }

GET /api/v1/transactions/today?outlet_id=
└ Response: [{ id, time, items[], total, channel, member_id }]

POST /api/v1/transactions/{id}/void
├ Request: { reason, approval_spv_id }
└ Response: { success, reversal_transaction_id }

GET /api/v1/transactions/history?outlet_id=&date_from=&date_to=&filter_by=channel
```

#### **Reports**
```
POST /api/v1/reports/daily-submit
├ Request:
│  {
│    outlet_id, pramuniaga_id, date,
│    omset, non_tunai, discounts, expenses,
│    actual_cash_counted, notes
│  }
└ Response: { report_id, success, status: pending_validation }

GET /api/v1/reports/my-reports?status=approved
└ Response: [{ report_id, date, omset, status, spv_notes }]

POST /api/v1/reports/{id}/validate
├ Request: { status: approved/rejected, notes, approval_by_spv }
└ Response: { success, status_updated }

GET /api/v1/reports/summary?region_id=&date_range=
└ Response (SPV): { total_omset, total_expenses, variance_summary }
```

#### **Inventory**
```
POST /api/v1/inventory/daily-check
├ Request:
│  {
│    outlet_id, date,
│    opening_balance, received, used, rejected, closing_balance,
│    variance_reason?
│  }
└ Response: { success, variance_flagged?, escalation_needed? }

POST /api/v1/inventory/stock-adjustment
├ Request: { outlet_id, product_id, qty_change, reason, photo_url }
└ Response: { success, approval_needed: true, assigned_to_spv }

GET /api/v1/inventory/stock-levels?outlet_id=
└ Response: [{ product_id, qty_on_hand, min_level, reorder_needed }]
```

#### **Members**
```
POST /api/v1/members/register
├ Request: { phone, name, outlet_id }
└ Response: { member_id, tier, points_balance }

GET /api/v1/members/lookup?phone=&member_id=
└ Response: { member_id, name, tier, points, transaction_history }

POST /api/v1/members/{id}/redeem-points
├ Request: { points_amount, transaction_id }
└ Response: { success, remaining_points }

GET /api/v1/members/analytics?outlet_id=&date_range=
└ Response (Marketing): { total_members, active_count, ltv, tier_distribution }
```

#### **Master Admin**
```
POST /api/v1/admin/users/create
├ Request: { email, name, role, division, outlet_id?, temp_password }
└ Response: { user_id, success, welcome_email_sent }

PUT /api/v1/admin/users/{id}
├ Request: { name, role, division, status, permissions }
└ Response: { success, updated_user }

POST /api/v1/admin/products
├ Request: { sku, name, category, price, cost, outlet_availability }
└ Response: { product_id, success }

GET /api/v1/admin/audit-trail?date_from=&date_to=&filter_by=user
└ Response: [{ timestamp, user, action, entity, old_value, new_value }]
```

---

## 🗓 IMPLEMENTATION ROADMAP

### **PHASE 1: CORE PLATFORM (Week 1-8)**

**Sprint 1-2: Foundation & Auth (Week 1-2)**
- [ ] Database schema design & setup
- [ ] Authentication system (email/password, 2FA)
- [ ] User roles & permissions engine
- [ ] Deployment pipeline setup (CI/CD)
- [ ] Testing framework setup

**Sprint 3-4: Attendance & POS (Week 3-4)**
- [ ] Attendance module (check-in/out, checkpoints)
- [ ] POS system (product selection, payment methods)
- [ ] Transaction logging & validation
- [ ] Mobile app (React Native) skeleton
- [ ] Web dashboard (React) skeleton

**Sprint 5-6: Reporting & Validation (Week 5-6)**
- [ ] Daily report submission flow
- [ ] SPV validation dashboard
- [ ] Reconciliation engine
- [ ] Variance detection & flagging
- [ ] Expense tracking module

**Sprint 7-8: Pilot & Stabilization (Week 7-8)**
- [ ] Pilot deployment (3 outlets: Cilegon, Karawaci, Serang)
- [ ] Staff training & onboarding
- [ ] Bug fixes & performance optimization
- [ ] Inventory module basic version
- [ ] Member registration (basic)

**Phase 1 Success Criteria:**
- ✅ System uptime >99%
- ✅ <1% data entry error rate
- ✅ >85% user adoption in pilot outlets
- ✅ 0 critical data loss incidents
- ✅ Report reconciliation <1 hour (vs 8 hours manual)

---

### **PHASE 2: FULL PLATFORM & SCALE (Week 9-20)**

**Sprint 9-10: Nationwide Rollout (Week 9-10)**
- [ ] Expand to all 63 outlets (phased by region)
- [ ] Regional training programs
- [ ] Support ticketing system
- [ ] Incident response procedures

**Sprint 11-12: Executive Dashboard (Week 11-12)**
- [ ] CEO/executive KPI dashboard
- [ ] Real-time alerts & notifications
- [ ] Advanced analytics & forecasting
- [ ] Export functionality (PDF/Excel)

**Sprint 13-14: Division Modules (Week 13-14)**
- [ ] Operasional Admin & Field modules
- [ ] HRGA full attendance management
- [ ] FA accounting integration
- [ ] Marketing campaign management

**Sprint 15-16: Integrations (Week 15-16)**
- [ ] Grab API integration (order sync)
- [ ] GoFood API integration
- [ ] Shopee API integration
- [ ] Payment settlement reconciliation

**Sprint 17-18: Optimization (Week 17-18)**
- [ ] Performance tuning (database, API response times)
- [ ] Load testing (simulate 300 concurrent users)
- [ ] Security audit & penetration testing
- [ ] Backup & disaster recovery testing

**Sprint 19-20: Migration & Go-Live (Week 19-20)**
- [ ] Data migration from Phase 1 staging to production
- [ ] Supabase production setup
- [ ] Final testing & UAT sign-off
- [ ] Go-live support (24/7 on-call)

**Phase 2 Success Criteria:**
- ✅ 99.9% system uptime
- ✅ >95% user adoption across all divisions
- ✅ <30 minute daily reconciliation (vs 8 hours)
- ✅ Real-time dashboards with <5 second latency
- ✅ Zero manual reconciliation errors

---

## 🛠️ TECHNICAL STACK

### **Frontend**
```
Technology Stack:
├── Framework: Next.js 14+ (React 18+)
├── UI Library: TailwindCSS + shadcn/ui
├── State Management: TanStack Query (React Query) + Zustand
├── Mobile: React Native (Expo) for Pramuniaga app
├── Charts/Analytics: Recharts, Chart.js
├── Maps: Mapbox GL (for GPS tracking)
└── Real-time: Socket.io client

Development Tools:
├── TypeScript (strict mode)
├── ESLint + Prettier
├── Storybook (component library)
├── Jest + React Testing Library
└── E2E Testing: Playwright
```

### **Backend**
```
Technology Stack:
├── Runtime: Node.js 18+
├── Framework: Next.js API Routes (Phase 1) → NestJS (Phase 2, optional)
├── Database: PostgreSQL (via Supabase)
├── ORM: Prisma
├── Cache: Redis (Upstash for serverless)
├── Real-time: Socket.io server
└── Task Queue: Bull (Redis-backed)

API & Integrations:
├── API Documentation: Swagger/OpenAPI
├── Authentication: JWT + refresh tokens
├── External APIs: Grab, GoFood, Shopee, payment gateways
└── File Storage: Supabase Storage (for receipts, photos)
```

### **Infrastructure & DevOps**
```
Hosting & Deployment:
├── Frontend: Vercel (Next.js optimized)
├── Backend: Vercel (serverless) or Railway (containerized)
├── Database: Supabase (PostgreSQL managed)
├── Cache: Upstash Redis
└── Storage: Supabase Storage / AWS S3

CI/CD Pipeline:
├── Version Control: GitHub
├── CI: GitHub Actions
├── Testing: Automated tests on every push
├── Staging: Auto-deploy to staging on PR
└── Production: Manual approval required

Monitoring & Logging:
├── Error Tracking: Sentry
├── Performance: New Relic / DataDog
├── Logging: Supabase logging + CloudWatch
└── Uptime Monitoring: Uptime Robot
```

---

## 🔒 SECURITY & COMPLIANCE

### **Authentication & Authorization**
```
✓ Multi-factor Authentication (2FA)
   ├── TOTP (Time-based One-Time Password) via authenticator app
   ├── SMS OTP (optional fallback)
   └── Biometric (fingerprint/face for mobile app)

✓ Role-Based Access Control (RBAC)
   ├── Granular permissions per role
   ├── Dynamic permission assignment
   └── Just-in-time (JIT) access elevation

✓ Session Management
   ├── Session timeout (30 minutes inactivity)
   ├── Force logout on role change
   └── Single active session per user (optional)
```

### **Data Protection**
```
✓ Encryption
   ├── TLS 1.3 for all API communications
   ├── AES-256 for sensitive data at rest (passwords, financial data)
   └── PCI-DSS compliance for payment data

✓ Data Privacy
   ├── GDPR-compliant member data handling
   ├── Member data deletion (right to be forgotten)
   ├── Privacy policy & consent management
   └── Data retention policy (2-year minimum for compliance)

✓ Audit Trail
   ├── Immutable audit log (no deletion, only append)
   ├── Log all user actions (CRUD operations)
   ├── Retention: Minimum 2 years
   └── Export: For compliance audits
```

### **Vulnerability Management**
```
✓ Regular Security Testing
   ├── OWASP Top 10 scanning (automated)
   ├── Dependency scanning (npm/package vulnerabilities)
   ├── Penetration testing (quarterly)
   └── Code review (peer review + static analysis)

✓ Incident Response
   ├── Security breach protocol
   ├── Incident response team (on-call 24/7)
   ├── Customer notification SLA (48 hours)
   └── Post-incident review & lessons learned
```

---

## 📊 SUCCESS METRICS & KPIs

### **Phase 1 Targets**
| Metric | Target | Measurement |
|--------|--------|-------------|
| System Uptime | 99.5% | Uptime Robot |
| User Adoption | >85% | Daily active users / total users |
| Data Accuracy | 99%+ | Variance <1% between POS and reports |
| Report Cycle Time | <30 min | From submission to approval |
| Error Rate | <1% | Manual data entry errors |
| User Satisfaction | >4.0/5 | NPS score |

### **Phase 2 Targets**
| Metric | Target | Measurement |
|--------|--------|-------------|
| System Uptime | 99.9% | Uptime Robot |
| User Adoption | >95% | Across all divisions |
| Real-time Dashboard | <5s latency | API response time |
| Auto-reconciliation | 100% | No manual reconciliation needed |
| Decision Speed | <2 hours | From data to insight to action |
| Scalability | 1000 concurrent users | Load test results |

---

## 📞 SUPPORT & MAINTENANCE

### **Post-Launch Support**
```
Phase 1 (Week 1-4 after launch):
├── 24/7 on-call support team
├── Daily standups with divisional heads
├── Hotfix SLA: Critical (1 hour), High (4 hours)
└── Weekly performance review

Phase 2 onwards (Steady state):
├── Business hours support + on-call emergency
├── Monthly health checks & optimization
├── Quarterly feature roadmap reviews
└── Annual security audit
```

### **Maintenance & Updates**
```
Weekly:
├── Automated dependency updates (patch versions)
├── Security patching (if critical)
└── Database backups & verification

Monthly:
├── Performance optimization
├── User feedback review & prioritization
└── Capacity planning review

Quarterly:
├── Major feature releases (Phase 2)
├── Security audit
└── Disaster recovery drill
```

---

**END OF PRD**

Version 1.0 | Approved by: _________________ | Date: _____________
