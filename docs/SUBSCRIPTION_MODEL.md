# 💳 SUBSCRIPTION MODEL - HCX Care

> **Product Strategy Document**  
> **Version**: 1.0  
> **Date**: Febrero 2026  
> **Owner**: Product & Engineering

---

## 📋 TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Plan Tiers & Pricing](#plan-tiers--pricing)
3. [Seat Counting Rules](#seat-counting-rules)
4. [Feature Matrix](#feature-matrix)
5. [Resource Limits](#resource-limits)
6. [Business Rules](#business-rules)
7. [Subscription States](#subscription-states)
8. [API Contract](#api-contract)
9. [Frontend UX Flows](#frontend-ux-flows)
10. [Migration & Edge Cases](#migration--edge-cases)

---

## 🎯 EXECUTIVE SUMMARY

### Pricing Model

**Seat-Based Pricing**: Only **PSYCHOLOGIST** users count as paid seats.

- **TENANT_ADMIN**: Does NOT count as seat (1 free admin per clinic)
- **PSYCHOLOGIST**: Counts as 1 seat (billable user)
- **ASSISTANT**: Does NOT count as seat (unlimited assistants)

### Why This Model?

1. **Revenue aligned with value**: Psychologists generate revenue (sessions)
2. **Easy to understand**: "Pay per psychologist" is simple messaging
3. **Scalable**: Clinics can add support staff without cost penalty
4. **Predictable**: Clinics know exactly what they'll pay

### Target Market Segments

| Segment | Size | Plan | Monthly Price |
|---------|------|------|---------------|
| **Solo Practitioner** | 1 psychologist | BASIC | €29/mo |
| **Small Clinic** | 2-5 psychologists | PRO | €79-€199/mo |
| **Medium Clinic** | 6-15 psychologists | PRO/CUSTOM | €239-€599/mo |
| **Large Organization** | 15+ psychologists | CUSTOM | Custom pricing |

---

## 💰 PLAN TIERS & PRICING

### 1. BASIC Plan

**Target**: Solo practitioners or very small practices

| Item | Value |
|------|-------|
| **Monthly Price** | €29/mo |
| **Annual Price** | €290/year (€24.17/mo, 17% discount) |
| **Psychologist Seats** | 1 included |
| **Additional Seats** | Not available (must upgrade to PRO) |
| **Trial Period** | 14 days free |

**Positioning**: "Get started with essential features for solo practitioners"

---

### 2. PRO Plan

**Target**: Small to medium clinics (2-15 psychologists)

| Item | Value |
|------|-------|
| **Base Monthly Price** | €79/mo (for 2 psychologists) |
| **Annual Base Price** | €790/year (€65.83/mo, 17% discount) |
| **Included Seats** | 2 psychologists |
| **Additional Seats** | €40/mo per psychologist |
| **Max Seats** | 15 psychologists |
| **Trial Period** | 14 days free |

**Pricing Examples**:
- 2 psychologists: €79/mo
- 5 psychologists: €79 + (3 × €40) = €199/mo
- 10 psychologists: €79 + (8 × €40) = €399/mo
- 15 psychologists: €79 + (13 × €40) = €599/mo

**Positioning**: "Professional tools for growing clinics"

---

### 3. CUSTOM Plan

**Target**: Large organizations, enterprise clients

| Item | Value |
|------|-------|
| **Pricing** | Custom negotiated |
| **Seats** | Unlimited (or custom limit) |
| **Billing** | Annual contract |
| **Onboarding** | Dedicated support |
| **SLA** | 99.9% uptime guarantee |
| **Support** | Priority phone + dedicated account manager |

**Minimum Commitment**: €5,000/year (typically 15+ psychologists)

**Positioning**: "Enterprise-grade solution with white-glove service"

---

## 👥 SEAT COUNTING RULES

### What Counts as a Seat?

```
SEAT = User with role PSYCHOLOGIST AND status = ACTIVE
```

### Detailed Rules

| Role | Counts as Seat? | Cost | Limit |
|------|-----------------|------|-------|
| **TENANT_ADMIN** | ❌ No | Free | 1 per clinic (hardcoded) |
| **PSYCHOLOGIST** | ✅ Yes | Paid | Plan-dependent |
| **ASSISTANT** | ❌ No | Free | Unlimited |

### Seat Calculation Examples

**Example 1: Small Clinic**
- 1 Admin (TENANT_ADMIN)
- 3 Psychologists (PSYCHOLOGIST, ACTIVE)
- 2 Assistants (ASSISTANT)
- **Billable Seats**: 3

**Example 2: Deactivated Users**
- 1 Admin (TENANT_ADMIN)
- 5 Psychologists (PSYCHOLOGIST, ACTIVE)
- 2 Psychologists (PSYCHOLOGIST, INACTIVE)
- 3 Assistants (ASSISTANT)
- **Billable Seats**: 5 (inactive users don't count)

### Seat Status Lifecycle

```
INVITED → ACTIVE → INACTIVE → DELETED
   ↓         ↓         ↓         ↓
  Free     Counted    Free    Free
```

**Key Points**:
1. **INVITED** users don't count until they accept and become ACTIVE
2. **INACTIVE** users are "soft deleted" and don't count
3. **DELETED** users are permanently removed
4. Reactivating an INACTIVE user requires available seat capacity

---

## ⚡ FEATURE MATRIX

### Features by Plan

| Feature | BASIC | PRO | CUSTOM |
|---------|-------|-----|--------|
| **Core Features** |
| Dashboard | ✅ | ✅ | ✅ |
| Calendar | ✅ | ✅ | ✅ |
| Appointments (CRUD) | ✅ | ✅ | ✅ |
| Patient Records | ✅ | ✅ | ✅ |
| **Advanced Features** |
| Clinical Notes | ❌ | ✅ | ✅ |
| Tasks Management | ❌ | ✅ | ✅ |
| File Attachments | ❌ | ✅ | ✅ |
| Session Plans | ❌ | ✅ | ✅ |
| **Notifications** |
| In-App Notifications | ✅ | ✅ | ✅ |
| Email Notifications | ✅ (100/mo) | ✅ (1,000/mo) | ✅ (Unlimited) |
| Web Push | ❌ | ✅ | ✅ |
| SMS Notifications (FCM) | ❌ | ❌ | ✅ |
| **Analytics & Reports** |
| Basic Stats | ✅ | ✅ | ✅ |
| Advanced Analytics | ❌ | ✅ | ✅ |
| Custom Reports | ❌ | ❌ | ✅ |
| Export Data (CSV/PDF) | ❌ | ✅ | ✅ |
| **Integrations** |
| Google Calendar Sync | ❌ | ✅ | ✅ |
| Zoom/Video Calls | ❌ | ✅ | ✅ |
| API Access | ❌ | Read-only | Full access |
| Webhooks | ❌ | ❌ | ✅ |
| **Support** |
| Email Support | ✅ (48h) | ✅ (24h) | ✅ (4h) |
| Phone Support | ❌ | ❌ | ✅ |
| Dedicated Account Manager | ❌ | ❌ | ✅ |
| Onboarding Assistance | Self-service | Video call | White-glove |
| **Security & Compliance** |
| Data Encryption | ✅ | ✅ | ✅ |
| 2FA/MFA | ❌ | ✅ | ✅ |
| SSO (SAML) | ❌ | ❌ | ✅ |
| HIPAA Compliance | ✅ | ✅ | ✅ + BAA |
| Audit Logs | 30 days | 90 days | 365 days |
| **Backups** |
| Automatic Backups | Daily | Daily | Hourly |
| Backup Retention | 7 days | 30 days | 90 days |
| Manual Export | ❌ | ✅ | ✅ |

### Feature Flags (Implementation)

```typescript
// Backend: Feature flag checking
interface FeatureFlags {
  clinicalNotes: boolean;
  tasks: boolean;
  attachments: boolean;
  webPush: boolean;
  smsNotifications: boolean;
  advancedAnalytics: boolean;
  customReports: boolean;
  apiAccess: 'none' | 'read' | 'full';
  videoIntegration: boolean;
  webhooks: boolean;
  sso: boolean;
  mfa: boolean;
}

function getFeatureFlags(planTier: PlanTier): FeatureFlags {
  switch (planTier) {
    case 'BASIC':
      return {
        clinicalNotes: false,
        tasks: false,
        attachments: false,
        webPush: false,
        smsNotifications: false,
        advancedAnalytics: false,
        customReports: false,
        apiAccess: 'none',
        videoIntegration: false,
        webhooks: false,
        sso: false,
        mfa: false,
      };
    case 'PRO':
      return {
        clinicalNotes: true,
        tasks: true,
        attachments: true,
        webPush: true,
        smsNotifications: false,
        advancedAnalytics: true,
        customReports: false,
        apiAccess: 'read',
        videoIntegration: true,
        webhooks: false,
        sso: false,
        mfa: true,
      };
    case 'CUSTOM':
      return {
        clinicalNotes: true,
        tasks: true,
        attachments: true,
        webPush: true,
        smsNotifications: true,
        advancedAnalytics: true,
        customReports: true,
        apiAccess: 'full',
        videoIntegration: true,
        webhooks: true,
        sso: true,
        mfa: true,
      };
  }
}
```

---

## 📊 RESOURCE LIMITS

### Limits by Plan

| Resource | BASIC | PRO | CUSTOM |
|----------|-------|-----|--------|
| **Users** |
| Psychologists (seats) | 1 | 2-15 | Unlimited |
| Admins | 1 | 1 | Up to 3 |
| Assistants | 3 | Unlimited | Unlimited |
| **Patients** |
| Active Patients | 50 | 500 | Unlimited |
| Archived Patients | Unlimited | Unlimited | Unlimited |
| **Appointments** |
| Monthly Appointments | 200 | 2,000 | Unlimited |
| Concurrent Appointments | 5 | 50 | Unlimited |
| **Storage** |
| Total Storage | 2 GB | 50 GB | 500 GB+ |
| Per File Size | 5 MB | 25 MB | 100 MB |
| **Notifications** |
| Email/month | 100 | 1,000 | Unlimited |
| Push/month | N/A | 5,000 | Unlimited |
| SMS/month | N/A | N/A | Custom |
| **API** |
| Requests/hour | N/A | 1,000 | 10,000 |
| Rate Limit | N/A | 60 req/min | 300 req/min |

### Limit Enforcement

**Soft Limits** (Warning only):
- 80% of patient limit: Show warning banner
- 90% of storage: Email to admin
- 85% of monthly notifications: Dashboard alert

**Hard Limits** (Blocking):
- 100% of psychologist seats: Block new PSYCHOLOGIST invites
- 100% of patient limit: Block new patient creation
- 100% of storage: Block file uploads
- 100% of monthly notifications: Queue notifications for next month

### Grace Periods

| Action | Grace Period | Behavior |
|--------|--------------|----------|
| **Exceed patient limit** | 7 days | Can add patients, shown upgrade prompt |
| **Exceed storage** | Immediate | Cannot upload files |
| **Exceed seats** | Immediate | Cannot activate new psychologists |
| **Past due payment** | 15 days | Read-only mode after 15 days |
| **Canceled subscription** | 30 days | Data export available, then archive |

---

## 📋 BUSINESS RULES

### 1. Upgrade Rules

#### Automatic Upgrades
- **NOT ALLOWED**: No auto-upgrades without explicit user action
- **Reason**: Pricing changes require user consent

#### Manual Upgrades

**BASIC → PRO**:
- ✅ Allowed anytime
- Prorated credit for remaining BASIC period
- Immediately unlock PRO features
- Can add 2nd psychologist immediately
- Email confirmation sent

**PRO → CUSTOM**:
- ✅ Requires sales call (contact form)
- Annual contract negotiation
- Migration assistance included
- No self-service upgrade

**Seat Addition (within PRO)**:
- ✅ Instant seat addition
- Prorated charge for current billing period
- New psychologist can be invited immediately
- Auto-billing on next cycle

#### Proration Logic

```typescript
// Example: BASIC (€29/mo) → PRO (€79/mo) with 15 days left
const daysRemaining = 15;
const daysInMonth = 30;
const basicRefund = (29 / 30) * 15 = €14.50;
const proCharge = (79 / 30) * 15 = €39.50;
const netCharge = €39.50 - €14.50 = €25.00;

// Customer pays €25 today, then €79/mo on next billing cycle
```

### 2. Downgrade Rules

#### BASIC ← PRO

**Allowed IF**:
- ✅ Only 1 active PSYCHOLOGIST user
- ✅ ≤ 50 active patients
- ✅ ≤ 2 GB storage used
- ✅ No dependencies on PRO-only features

**Process**:
1. System checks constraints
2. If violations exist, show blocker:
   - "You have 3 psychologists. Deactivate 2 to downgrade."
   - "You have 75 patients. Archive 25 to downgrade."
3. User resolves blockers
4. Downgrade scheduled for end of current billing period
5. PRO features locked on downgrade date
6. Credit applied to BASIC plan

**PRO-Only Feature Handling**:
- **Clinical notes**: Remain in database (read-only), not editable
- **Tasks**: Hidden from UI, data preserved
- **Attachments**: Downloads allowed, uploads blocked
- **Web Push**: Subscriptions disabled

#### PRO ← CUSTOM

**Allowed IF**:
- ✅ ≤ 15 active psychologists
- ✅ No active SSO users
- ✅ No webhook dependencies

**Process**:
1. Requires mutual agreement (contractual)
2. 30-day notice period
3. Migration assistance provided
4. Custom integrations deactivated
5. API access downgraded to read-only

### 3. Seat Management Rules

#### Adding a Psychologist

**Constraint Check**:
```typescript
function canAddPsychologist(tenant: Tenant): boolean {
  const activePsychologists = tenant.users.filter(
    u => u.role === 'PSYCHOLOGIST' && u.status === 'ACTIVE'
  ).length;
  
  const plan = tenant.subscription.plan;
  
  if (plan.tier === 'BASIC') {
    return activePsychologists < 1; // Max 1
  }
  
  if (plan.tier === 'PRO') {
    return activePsychologists < 15; // Max 15
  }
  
  if (plan.tier === 'CUSTOM') {
    return activePsychologists < plan.customLimits.maxPsychologists;
  }
  
  return false;
}
```

**Enforcement Point**: `inviteUser()` API endpoint

**UX Flow** (if limit reached):
1. User clicks "Invite Psychologist"
2. Backend returns 403: "Seat limit reached"
3. Frontend shows modal:
   - "You've reached your plan limit (1 psychologist)"
   - "Upgrade to PRO to add more psychologists"
   - [Upgrade to PRO] button → `/admin/subscription?action=upgrade`

#### Deactivating a Psychologist

**Allowed**: Always (frees up a seat)

**Process**:
1. Psychologist status → INACTIVE
2. Seat count decrements immediately
3. User loses access immediately
4. Billing adjusts next cycle (no refund for partial month)
5. Appointments remain assigned (historical data)

**Reactivating**:
- Requires available seat capacity
- Same constraint check as new invite

### 4. Patient Limit Rules

#### Adding a Patient

**Constraint Check**:
```typescript
function canAddPatient(tenant: Tenant): boolean {
  const activePatients = tenant.patients.filter(
    p => p.status === 'ACTIVE'
  ).length;
  
  const limit = tenant.subscription.plan.limits.maxPatients;
  
  return activePatients < limit;
}
```

**Enforcement**: 
- **Hard block** at 100% of limit (after grace period)
- **Soft warning** at 80% of limit

**UX Flow** (at 80%):
- Banner: "You're using 40/50 patient slots. Upgrade to PRO for 500 patients."
- Dismissible for 7 days

**UX Flow** (at 100% after grace):
1. User clicks "New Patient"
2. Modal: "Patient limit reached (50/50)"
3. Options:
   - [Archive inactive patients] → Patient archive flow
   - [Upgrade to PRO] → `/admin/subscription?action=upgrade`

### 5. Storage Limit Rules

#### File Upload

**Constraint Check**:
```typescript
function canUploadFile(tenant: Tenant, fileSizeBytes: number): boolean {
  const currentUsageGB = tenant.subscription.usage.storageUsedGB;
  const limitGB = tenant.subscription.plan.limits.storageGB;
  const newUsageGB = currentUsageGB + (fileSizeBytes / 1e9);
  
  return newUsageGB <= limitGB;
}
```

**Enforcement**: Immediate hard block

**UX Flow**:
1. User uploads file
2. Frontend checks size against remaining quota (optimistic)
3. Backend validates
4. If rejected (413 Payload Too Large):
   - Toast: "Storage limit reached. Delete files or upgrade."
   - Link to storage management page
   - Link to upgrade

### 6. Notification Limit Rules

#### Sending Notification

**Constraint Check**:
```typescript
function canSendNotification(
  tenant: Tenant,
  type: 'email' | 'push' | 'sms'
): boolean {
  const usage = tenant.subscription.usage;
  const limits = tenant.subscription.plan.limits;
  
  switch (type) {
    case 'email':
      return usage.emailsSentThisMonth < limits.maxEmailsPerMonth;
    case 'push':
      return usage.pushSentThisMonth < limits.maxPushPerMonth;
    case 'sms':
      return usage.smsSentThisMonth < limits.maxSmsPerMonth;
  }
}
```

**Enforcement**: 
- **Queue** notifications if limit reached
- **Send** on 1st of next month

**UX Flow**:
- No user-facing error (transparent)
- Admin dashboard shows: "Email notifications paused (limit reached). Resets on March 1."

---

## 🔄 SUBSCRIPTION STATES

### State Machine

```
┌─────────────┐
│   TRIAL     │──────────────┐
│ (14 days)   │              │
└──────┬──────┘              │
       │                     │
   [Convert]             [Expire]
       │                     │
       ↓                     ↓
┌─────────────┐        ┌──────────────┐
│   ACTIVE    │───────→│  TRIALING    │
│             │        │   (Expired)  │
└──────┬──────┘        └──────────────┘
       │                      │
 [Payment fails]              │
       │                      │
       ↓                      │
┌─────────────┐               │
│  PAST_DUE   │               │
│ (15 days)   │               │
└──────┬──────┘               │
       │                      │
   [Still not paid]       [Cancel]
       │                      │
       ↓                      ↓
┌─────────────┐        ┌──────────────┐
│  SUSPENDED  │←───────│  CANCELED    │
│ (Read-only) │        │  (30 days)   │
└──────┬──────┘        └──────┬───────┘
       │                      │
 [Data retention]        [Data retention]
       │                      │
       ↓                      ↓
┌─────────────┐        ┌──────────────┐
│  ARCHIVED   │        │   DELETED    │
│             │        │              │
└─────────────┘        └──────────────┘
```

### State Behaviors

#### 1. TRIAL

**Duration**: 14 days from signup

**Access**:
- ✅ Full access to plan features
- ✅ No credit card required (optional)

**Limits**:
- Same as target plan (BASIC or PRO)

**Transitions**:
- **→ ACTIVE**: Credit card added + payment successful
- **→ TRIALING_EXPIRED**: 14 days pass without payment method
- **→ CANCELED**: User cancels during trial

**UX**:
- Banner: "X days left in trial. Add payment method to continue."
- Daily reminder emails (last 3 days)

#### 2. ACTIVE

**Status**: Subscription in good standing

**Access**:
- ✅ Full access to all plan features
- ✅ All limits enforced per plan

**Billing**:
- Monthly auto-charge on billing date
- Invoice emailed after successful payment

**Transitions**:
- **→ PAST_DUE**: Payment fails
- **→ CANCELED**: User cancels subscription

#### 3. PAST_DUE

**Trigger**: Payment failed (card declined, insufficient funds, etc.)

**Duration**: Up to 15 days

**Access** (Days 1-7):
- ✅ Full access (grace period)
- ⚠️ Warning banner: "Payment failed. Update payment method."

**Access** (Days 8-15):
- ⚠️ Degraded access:
  - Can view data (read-only)
  - Cannot create new records
  - Cannot invite users
  - Cannot upload files

**Retry Logic**:
- Day 1: Immediate retry
- Day 3: Retry
- Day 7: Retry
- Day 10: Retry
- Day 15: Final retry

**Transitions**:
- **→ ACTIVE**: Payment succeeds on retry
- **→ SUSPENDED**: 15 days pass, all retries failed

**Notifications**:
- Immediate email to admin on failure
- Daily emails (days 1, 3, 5, 7, 10, 12, 14, 15)
- In-app banner (persistent)

#### 4. SUSPENDED

**Trigger**: PAST_DUE for 15+ days

**Access**:
- ❌ Read-only mode only
- Can view existing data
- Cannot create, edit, or delete anything
- Cannot invite users

**Banner**: "Subscription suspended. Update payment to restore access."

**Data**:
- ✅ All data preserved
- ✅ Backups continue

**Transitions**:
- **→ ACTIVE**: Payment method updated + payment succeeds
- **→ ARCHIVED**: 30 days in SUSPENDED state

#### 5. CANCELED

**Trigger**: User explicitly cancels subscription

**Access** (Days 1-30):
- ✅ Full access until end of billing period
- Then read-only mode

**Access** (After billing period):
- ❌ Read-only mode
- Data export available
- 30-day data retention

**Transitions**:
- **→ ACTIVE**: User reactivates within 30 days
- **→ DELETED**: 30 days pass

**UX**:
- "Your subscription ends on March 15. Reactivate anytime before then."
- Email reminders (day 7, day 1 before deletion)
- Final email: "Last chance to export your data"

#### 6. ARCHIVED

**Trigger**: Suspended for 30+ days, no payment recovery

**Access**:
- ❌ No access to app
- Data stored in cold storage

**Data Retention**: 90 days

**Transitions**:
- **→ ACTIVE**: Payment recovered (rare, requires support intervention)
- **→ DELETED**: 90 days pass

#### 7. DELETED

**Trigger**: Archived for 90+ days OR user requests deletion

**Access**: None

**Data**: Permanently deleted (GDPR compliance)

**Irreversible**: Cannot be recovered

---

## 🔌 API CONTRACT

### 1. Get Current Subscription

**Endpoint**: `GET /api/v1/subscription`

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Response** (200 OK):
```typescript
interface SubscriptionResponse {
  id: string;
  tenantId: string;
  plan: {
    tier: 'BASIC' | 'PRO' | 'CUSTOM';
    name: string;
    billingInterval: 'MONTHLY' | 'ANNUAL';
    basePrice: number; // in cents
    currency: 'EUR';
    limits: {
      maxPsychologists: number;
      maxAssistants: number;
      maxPatients: number;
      storageGB: number;
      maxEmailsPerMonth: number;
      maxPushPerMonth: number;
      maxSmsPerMonth: number;
    };
    features: {
      clinicalNotes: boolean;
      tasks: boolean;
      attachments: boolean;
      webPush: boolean;
      smsNotifications: boolean;
      advancedAnalytics: boolean;
      customReports: boolean;
      apiAccess: 'none' | 'read' | 'full';
      videoIntegration: boolean;
      webhooks: boolean;
      sso: boolean;
      mfa: boolean;
    };
  };
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED' | 'ARCHIVED';
  trialEndsAt: string | null; // ISO 8601
  currentPeriodStart: string; // ISO 8601
  currentPeriodEnd: string; // ISO 8601
  canceledAt: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Error Responses**:
- 401 Unauthorized: Invalid/missing token
- 404 Not Found: No subscription for tenant

---

### 2. Get Usage Metrics

**Endpoint**: `GET /api/v1/subscription/usage`

**Query Parameters**:
- `period`: Optional. `current` (default) | `previous` | `YYYY-MM`

**Response** (200 OK):
```typescript
interface UsageMetricsResponse {
  tenantId: string;
  period: {
    start: string; // ISO 8601
    end: string; // ISO 8601
  };
  users: {
    admins: {
      total: number;
      active: number;
    };
    psychologists: {
      total: number;
      active: number; // Billable count
      inactive: number;
      limit: number;
      percentUsed: number; // 0-100
    };
    assistants: {
      total: number;
      active: number;
      limit: number | null; // null = unlimited
    };
  };
  patients: {
    total: number;
    active: number;
    archived: number;
    limit: number;
    percentUsed: number;
  };
  storage: {
    usedGB: number;
    limitGB: number;
    percentUsed: number;
    breakdown: {
      attachments: number; // GB
      avatars: number;
      exports: number;
    };
  };
  notifications: {
    email: {
      sent: number;
      limit: number;
      percentUsed: number;
    };
    push: {
      sent: number;
      limit: number;
      percentUsed: number;
    };
    sms: {
      sent: number;
      limit: number;
      percentUsed: number;
    };
  };
  appointments: {
    total: number;
    completed: number;
    upcoming: number;
    canceled: number;
  };
  api: {
    requests: number;
    limit: number | null;
  };
}
```

---

### 3. Upgrade Plan

**Endpoint**: `POST /api/v1/subscription/upgrade`

**Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:
```typescript
interface UpgradeRequest {
  targetTier: 'PRO' | 'CUSTOM';
  billingInterval?: 'MONTHLY' | 'ANNUAL';
  addSeats?: number; // For PRO plan
  paymentMethodId?: string; // Stripe payment method
  couponCode?: string; // Optional promo code
}
```

**Request Example**:
```json
{
  "targetTier": "PRO",
  "billingInterval": "MONTHLY",
  "addSeats": 0,
  "paymentMethodId": "pm_1234567890"
}
```

**Response** (200 OK):
```typescript
interface UpgradeResponse {
  success: true;
  subscription: SubscriptionResponse;
  payment: {
    proratedAmount: number; // in cents
    nextBillingAmount: number;
    nextBillingDate: string; // ISO 8601
  };
  message: string; // "Successfully upgraded to PRO plan"
}
```

**Error Responses**:

**400 Bad Request** (Invalid upgrade):
```json
{
  "error": "INVALID_UPGRADE",
  "message": "Cannot downgrade using upgrade endpoint",
  "details": {
    "currentTier": "CUSTOM",
    "requestedTier": "PRO"
  }
}
```

**403 Forbidden** (Constraint violation):
```json
{
  "error": "CONSTRAINT_VIOLATION",
  "message": "Cannot upgrade to PRO: active psychologists (20) exceeds PRO limit (15)",
  "details": {
    "constraint": "maxPsychologists",
    "current": 20,
    "limit": 15,
    "suggestion": "Upgrade to CUSTOM or deactivate 5 psychologists"
  }
}
```

**402 Payment Required** (Payment failed):
```json
{
  "error": "PAYMENT_FAILED",
  "message": "Card declined",
  "details": {
    "code": "card_declined",
    "declineCode": "insufficient_funds"
  }
}
```

---

### 4. Invite User (with Seat Enforcement)

**Endpoint**: `POST /api/v1/users/invite`

**Request Body**:
```typescript
interface InviteUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: 'PSYCHOLOGIST' | 'ASSISTANT';
  professionalTitle?: string; // For psychologists
}
```

**Response** (200 OK):
```typescript
interface InviteUserResponse {
  success: true;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'PSYCHOLOGIST' | 'ASSISTANT';
    status: 'INVITED';
    invitedAt: string;
    inviteToken: string; // For invitation link
  };
  message: string;
}
```

**Error Responses**:

**403 Forbidden** (Seat limit reached):
```json
{
  "error": "SEAT_LIMIT_REACHED",
  "message": "Cannot invite psychologist: seat limit reached (1/1)",
  "details": {
    "currentSeats": 1,
    "maxSeats": 1,
    "planTier": "BASIC",
    "upgradeUrl": "/admin/subscription?action=upgrade",
    "suggestion": "Upgrade to PRO to add more psychologists"
  }
}
```

**400 Bad Request** (User already exists):
```json
{
  "error": "USER_EXISTS",
  "message": "User with email juan@clinic.com already exists",
  "details": {
    "userId": "user_123",
    "status": "ACTIVE"
  }
}
```

---

### 5. Add Seat (PRO Plan)

**Endpoint**: `POST /api/v1/subscription/seats`

**Request Body**:
```typescript
interface AddSeatRequest {
  quantity: number; // Number of seats to add
}
```

**Response** (200 OK):
```typescript
interface AddSeatResponse {
  success: true;
  subscription: {
    id: string;
    psychologistSeats: {
      previous: number;
      current: number;
      max: number;
    };
    pricing: {
      basePrice: number;
      pricePerSeat: number;
      addedSeats: number;
      totalMonthly: number;
    };
    proratedCharge: number; // Immediate charge for current period
    nextBillingAmount: number;
  };
}
```

**Error Responses**:

**400 Bad Request** (Exceeds max):
```json
{
  "error": "SEAT_LIMIT_EXCEEDED",
  "message": "Cannot add 10 seats: would exceed PRO plan maximum (15)",
  "details": {
    "currentSeats": 8,
    "requestedSeats": 10,
    "maxSeats": 15,
    "availableSeats": 7,
    "suggestion": "Add up to 7 seats or upgrade to CUSTOM"
  }
}
```

**409 Conflict** (Not on PRO plan):
```json
{
  "error": "PLAN_MISMATCH",
  "message": "Seat addition only available on PRO plan",
  "details": {
    "currentPlan": "BASIC",
    "suggestion": "Upgrade to PRO first"
  }
}
```

---

### 6. Downgrade Plan

**Endpoint**: `POST /api/v1/subscription/downgrade`

**Request Body**:
```typescript
interface DowngradeRequest {
  targetTier: 'BASIC'; // Only PRO → BASIC supported
  scheduledFor?: 'immediate' | 'end_of_period'; // Default: end_of_period
  acknowledgments: {
    dataLoss: boolean; // Must be true
    featureLoss: boolean; // Must be true
  };
}
```

**Response** (200 OK):
```typescript
interface DowngradeResponse {
  success: true;
  scheduledDowngrade: {
    fromTier: 'PRO';
    toTier: 'BASIC';
    effectiveDate: string; // ISO 8601
    daysUntilDowngrade: number;
  };
  impactSummary: {
    featuresLost: string[]; // ['Clinical Notes', 'Tasks', ...]
    constraintViolations: ConstraintViolation[]; // Empty if valid
  };
  creditIssued?: number; // If immediate downgrade
}
```

**Error Responses**:

**403 Forbidden** (Constraints violated):
```json
{
  "error": "DOWNGRADE_CONSTRAINTS_VIOLATED",
  "message": "Cannot downgrade: constraint violations must be resolved",
  "details": {
    "violations": [
      {
        "constraint": "maxPsychologists",
        "current": 3,
        "limit": 1,
        "action": "Deactivate 2 psychologists"
      },
      {
        "constraint": "maxPatients",
        "current": 75,
        "limit": 50,
        "action": "Archive 25 patients"
      },
      {
        "constraint": "storageGB",
        "current": 8.5,
        "limit": 2,
        "action": "Delete 6.5 GB of files"
      }
    ]
  }
}
```

---

## 🎨 FRONTEND UX FLOWS

### Flow 1: Seat Limit Reached (BASIC Plan)

#### Trigger
User clicks "Invitar Usuario" on Team page

#### Scenario
- Plan: BASIC
- Current psychologists: 1 (at limit)
- Wants to invite 2nd psychologist

#### UX Steps

1. **User Action**: Clicks "Invitar Usuario" button

2. **System Check**: Frontend calls `canInvitePsychologist()` helper
   ```typescript
   const canInvite = useMemo(() => {
     const psychologists = users.filter(
       u => u.role === 'PSYCHOLOGIST' && u.status === 'ACTIVE'
     ).length;
     return psychologists < subscription.plan.limits.maxPsychologists;
   }, [users, subscription]);
   ```

3. **Modal Display** (if limit reached):
   ```
   ┌─────────────────────────────────────────────┐
   │  ⚠️  Límite de Psicólogos Alcanzado         │
   ├─────────────────────────────────────────────┤
   │                                             │
   │  Has alcanzado el límite de tu plan BASIC: │
   │  1 psicólogo                                │
   │                                             │
   │  Para invitar más psicólogos, actualiza a  │
   │  nuestro plan PRO.                          │
   │                                             │
   │  Plan PRO incluye:                          │
   │  ✅ Hasta 15 psicólogos                     │
   │  ✅ Notas clínicas                          │
   │  ✅ Gestión de tareas                       │
   │  ✅ 500 pacientes                           │
   │  ✅ 50 GB de almacenamiento                 │
   │                                             │
   │  Precio: €79/mes para 2 psicólogos         │
   │  (+€40/mes por psicólogo adicional)         │
   │                                             │
   │  [ Cancelar ]    [ Ver Planes ]             │
   │                                             │
   │           [ Actualizar a PRO ]              │
   │              (€79/mes)                      │
   └─────────────────────────────────────────────┘
   ```

4. **Button Actions**:
   - **Cancelar**: Close modal
   - **Ver Planes**: Navigate to `/admin/subscription` (comparison view)
   - **Actualizar a PRO**: Navigate to `/admin/subscription/upgrade?plan=PRO`

5. **Upgrade Flow** (if "Actualizar a PRO" clicked):
   - Navigate to checkout page
   - Confirm payment method
   - Show proration calculation
   - Process upgrade
   - Success toast: "¡Plan actualizado a PRO!"
   - Automatically return to invite flow

---

### Flow 2: Patient Limit Warning (80% reached)

#### Trigger
User reaches 40/50 patients (80% of BASIC limit)

#### UX Steps

1. **Banner Display** (persistent on dashboard):
   ```
   ┌──────────────────────────────────────────────────────────────────┐
   │ ⚠️  Te estás acercando al límite de pacientes                    │
   │                                                                  │
   │ Has registrado 40 de 50 pacientes permitidos en el plan BASIC.  │
   │ Actualiza a PRO para 500 pacientes.                             │
   │                                                                  │
   │ [ Actualizar Plan ]       [ Recordarme más tarde ]              │
   └──────────────────────────────────────────────────────────────────┘
   ```

2. **Dashboard Widget**:
   ```
   ┌─────────────────────────────────┐
   │  Pacientes                      │
   ├─────────────────────────────────┤
   │                                 │
   │  40 / 50                        │
   │  ████████████████░░░░  80%      │
   │                                 │
   │  ⚠️ Límite próximo              │
   │  Quedan 10 espacios             │
   │                                 │
   │  [ Actualizar Plan ]            │
   └─────────────────────────────────┘
   ```

3. **Button Action**:
   - Navigate to `/admin/subscription?action=upgrade&reason=patients`

4. **Dismissal Logic**:
   - "Recordarme más tarde": Hide for 7 days (localStorage)
   - Auto-show again when reaching 90% or after 7 days

---

### Flow 3: Patient Limit Blocked (100% reached)

#### Trigger
User tries to create 51st patient (after 7-day grace period)

#### UX Steps

1. **User Action**: Clicks "Nuevo Paciente" button

2. **System Check**: 
   ```typescript
   const canAddPatient = useMemo(() => {
     const activePatients = patients.filter(p => p.status === 'ACTIVE').length;
     const limit = subscription.plan.limits.maxPatients;
     const graceExpired = hasGraceExpired(subscription.usage.patientLimit);
     
     return activePatients < limit || !graceExpired;
   }, [patients, subscription]);
   ```

3. **Modal Display**:
   ```
   ┌─────────────────────────────────────────────┐
   │  🚫  Límite de Pacientes Alcanzado          │
   ├─────────────────────────────────────────────┤
   │                                             │
   │  Has alcanzado el límite de 50 pacientes   │
   │  activos en tu plan BASIC.                  │
   │                                             │
   │  Para continuar agregando pacientes, elige  │
   │  una opción:                                │
   │                                             │
   │  📦 Archivar pacientes inactivos            │
   │     Libera espacio archivando pacientes     │
   │     que ya no están en tratamiento          │
   │                                             │
   │     [ Gestionar Pacientes ]                 │
   │                                             │
   │  🚀 Actualizar a Plan PRO                   │
   │     Aumenta tu límite a 500 pacientes       │
   │     + Notas clínicas ilimitadas             │
   │     + 50 GB de almacenamiento               │
   │                                             │
   │     Desde €79/mes                           │
   │                                             │
   │     [ Actualizar a PRO ]                    │
   │                                             │
   │  [ Cancelar ]                               │
   └─────────────────────────────────────────────┘
   ```

4. **Button Actions**:
   - **Gestionar Pacientes**: Navigate to `/patients?filter=inactive`
   - **Actualizar a PRO**: Navigate to `/admin/subscription/upgrade?plan=PRO&reason=patients`
   - **Cancelar**: Close modal

5. **Email Notification** (sent to admin when limit reached):
   ```
   Subject: Límite de pacientes alcanzado - Clínica ABC

   Hola Juan,

   Has alcanzado el límite de 50 pacientes activos en tu plan BASIC.

   Para continuar agregando pacientes:

   1. Archiva pacientes inactivos, o
   2. Actualiza a plan PRO (500 pacientes)

   [Actualizar Plan] [Gestionar Pacientes]
   ```

---

### Flow 4: Storage Limit Exceeded

#### Trigger
User tries to upload file that would exceed storage limit

#### UX Steps

1. **User Action**: Selects file to upload (e.g., 100 MB PDF)

2. **Frontend Check** (optimistic):
   ```typescript
   const remainingStorageGB = subscription.plan.limits.storageGB - 
                              subscription.usage.storageUsedGB;
   const remainingBytes = remainingStorageGB * 1e9;
   
   if (file.size > remainingBytes) {
     showStorageLimitModal();
     return;
   }
   ```

3. **Modal Display**:
   ```
   ┌─────────────────────────────────────────────┐
   │  💾  Límite de Almacenamiento Excedido      │
   ├─────────────────────────────────────────────┤
   │                                             │
   │  No se puede subir el archivo               │
   │  "Informe_Completo.pdf" (100 MB)            │
   │                                             │
   │  Almacenamiento usado: 1.95 GB / 2 GB       │
   │  Espacio disponible: 50 MB                  │
   │                                             │
   │  Opciones:                                  │
   │                                             │
   │  🗑️  Eliminar archivos antiguos              │
   │     Revisa y elimina archivos que ya no     │
   │     necesitas                               │
   │                                             │
   │     [ Gestionar Archivos ]                  │
   │                                             │
   │  📈 Actualizar a Plan PRO                   │
   │     Aumenta tu almacenamiento a 50 GB       │
   │                                             │
   │     [ Actualizar Plan ]                     │
   │                                             │
   │  [ Cancelar ]                               │
   └─────────────────────────────────────────────┘
   ```

4. **Storage Management Page** (`/admin/storage`):
   ```
   ┌─────────────────────────────────────────────┐
   │  Gestión de Almacenamiento                  │
   ├─────────────────────────────────────────────┤
   │                                             │
   │  Uso Actual: 1.95 GB / 2 GB (97.5%)         │
   │  ████████████████████░  97%                 │
   │                                             │
   │  Desglose:                                  │
   │  ├─ Adjuntos de pacientes  1.60 GB (82%)    │
   │  ├─ Avatares               0.15 GB (8%)     │
   │  └─ Exportaciones          0.20 GB (10%)    │
   │                                             │
   │  ──────────────────────────────────────────  │
   │                                             │
   │  Archivos más grandes:                      │
   │                                             │
   │  📄 Informe_Anual_2025.pdf      250 MB      │
   │     Paciente: María López                   │
   │     Fecha: 2025-12-15                       │
   │     [ Ver ] [ Descargar ] [ Eliminar ]      │
   │                                             │
   │  📄 Evaluacion_Completa.pdf     180 MB      │
   │     Paciente: Juan Pérez                    │
   │     Fecha: 2025-11-20                       │
   │     [ Ver ] [ Descargar ] [ Eliminar ]      │
   │                                             │
   │  [ Actualizar a PRO (50 GB) ]               │
   └─────────────────────────────────────────────┘
   ```

---

### Flow 5: Subscription Past Due (Payment Failed)

#### Trigger
Payment fails during auto-billing

#### UX Steps - Days 1-7 (Grace Period)

1. **Banner Display** (all pages):
   ```
   ┌──────────────────────────────────────────────────────────────────┐
   │ 🔴 URGENTE: Problema con el pago                                 │
   │                                                                  │
   │ Tu última factura de €79 no pudo procesarse. Actualiza tu medio │
   │ de pago antes del 15 de febrero para evitar la suspensión.      │
   │                                                                  │
   │ [ Actualizar Método de Pago ]          [ Ver Factura ]          │
   └──────────────────────────────────────────────────────────────────┘
   ```

2. **Email Notification** (immediate):
   ```
   Subject: ⚠️ Pago fallido - Acción requerida

   Hola Juan,

   Tu pago de €79 para Clínica ABC ha fallado.

   Razón: Tarjeta rechazada (fondos insuficientes)

   Por favor actualiza tu método de pago en los próximos 7 días
   para evitar la interrupción del servicio.

   [Actualizar Método de Pago]

   Reintentaremos el cobro automáticamente en 3 días.
   ```

3. **Dashboard Warning Widget**:
   ```
   ┌─────────────────────────────────┐
   │  ⚠️ Acción Requerida            │
   ├─────────────────────────────────┤
   │                                 │
   │  Pago fallido                   │
   │                                 │
   │  Tu suscripción vence en:       │
   │  7 días                         │
   │                                 │
   │  [ Actualizar Pago ]            │
   └─────────────────────────────────┘
   ```

#### UX Steps - Days 8-15 (Degraded Service)

1. **Banner Update** (more urgent):
   ```
   ┌──────────────────────────────────────────────────────────────────┐
   │ 🔴 SERVICIO RESTRINGIDO                                          │
   │                                                                  │
   │ Tu cuenta está en modo de solo lectura debido a pago pendiente. │
   │ Actualiza tu pago AHORA para restaurar el acceso completo.      │
   │                                                                  │
   │ Suspensión completa en: 7 días                                  │
   │                                                                  │
   │ [ ACTUALIZAR PAGO AHORA ]                                        │
   └──────────────────────────────────────────────────────────────────┘
   ```

2. **Blocking Modals** (on any create action):
   ```
   ┌─────────────────────────────────────────────┐
   │  🚫  Acción No Disponible                   │
   ├─────────────────────────────────────────────┤
   │                                             │
   │  No puedes crear nuevos registros porque    │
   │  tu suscripción tiene un pago pendiente.    │
   │                                             │
   │  Puedes ver tus datos existentes, pero no   │
   │  realizar cambios.                          │
   │                                             │
   │  [ Actualizar Método de Pago ]              │
   │                                             │
   │  ¿Necesitas ayuda?                          │
   │  [ Contactar Soporte ]                      │
   └─────────────────────────────────────────────┘
   ```

3. **Read-Only Indicators**:
   - All buttons disabled (visually grayed out)
   - Tooltip on hover: "Actualiza tu pago para habilitar esta función"
   - "Solo Lectura" badge on header

#### UX Steps - Day 15+ (Suspended)

1. **Full-Page Overlay**:
   ```
   ┌─────────────────────────────────────────────┐
   │                                             │
   │            🔒 Cuenta Suspendida             │
   │                                             │
   │  Tu suscripción ha sido suspendida debido   │
   │  a un pago pendiente de €79.                │
   │                                             │
   │  Puedes ver tus datos existentes en modo    │
   │  solo lectura, pero no podrás realizar      │
   │  ninguna acción hasta actualizar tu pago.   │
   │                                             │
   │  ───────────────────────────────────────    │
   │                                             │
   │  Último intento: 15 de febrero              │
   │  Monto adeudado: €79                        │
   │                                             │
   │  ───────────────────────────────────────    │
   │                                             │
   │  [ Actualizar Método de Pago ]              │
   │                                             │
   │  [ Ver Detalles de Factura ]                │
   │                                             │
   │  [ Exportar Mis Datos ]                     │
   │                                             │
   │  ───────────────────────────────────────    │
   │                                             │
   │  ¿Necesitas ayuda? Contáctanos              │
   │  soporte@example.com                        │
   │                                             │
   └─────────────────────────────────────────────┘
   ```

2. **Limited Navigation**:
   - Sidebar visible but all action items disabled
   - Only accessible: Dashboard (read-only), Subscription, Data Export
   - All other pages show suspension overlay

---

### Flow 6: Proactive Upgrade Prompts (Contextual)

#### Context 1: Viewing Clinical Notes (BASIC user)

**Trigger**: User clicks "Notas Clínicas" tab on patient detail

**Modal**:
```
┌─────────────────────────────────────────────┐
│  ✨ Función PRO: Notas Clínicas             │
├─────────────────────────────────────────────┤
│                                             │
│  Las notas clínicas están disponibles en    │
│  nuestro plan PRO.                          │
│                                             │
│  Con notas clínicas puedes:                 │
│  ✅ Registrar sesiones de forma segura      │
│  ✅ Acceso restringido por RBAC             │
│  ✅ Historial completo del tratamiento      │
│  ✅ Cumplimiento de normativas              │
│                                             │
│  Además incluye:                            │
│  • Gestión de tareas                        │
│  • 500 pacientes                            │
│  • 50 GB de almacenamiento                  │
│  • Notificaciones web push                  │
│                                             │
│  Desde €79/mes                              │
│                                             │
│  [ Actualizar a PRO ]    [ Más Tarde ]      │
└─────────────────────────────────────────────┘
```

#### Context 2: Trying to Create Task (BASIC user)

**Modal**:
```
┌─────────────────────────────────────────────┐
│  ✨ Función PRO: Gestión de Tareas          │
├─────────────────────────────────────────────┤
│                                             │
│  La gestión de tareas está disponible en    │
│  el plan PRO.                               │
│                                             │
│  Organiza el trabajo de tu equipo:          │
│  ✅ Asignar tareas a psicólogos             │
│  ✅ Fechas límite y recordatorios           │
│  ✅ Seguimiento de progreso                 │
│  ✅ Priorización de pendientes              │
│                                             │
│  [ Ver Planes ]    [ Actualizar Ahora ]     │
└─────────────────────────────────────────────┘
```

#### Context 3: Usage Approaching Limit (Dashboard)

**Card Display** (when at 70%+ of any limit):
```
┌─────────────────────────────────┐
│  💡 Recomendación                │
├─────────────────────────────────┤
│                                 │
│  Tu clínica está creciendo!     │
│                                 │
│  Uso actual:                    │
│  • Pacientes: 35/50 (70%)       │
│  • Almacenamiento: 1.4/2 GB     │
│                                 │
│  Considera actualizar a PRO     │
│  antes de alcanzar el límite:   │
│                                 │
│  ✅ 500 pacientes               │
│  ✅ 50 GB almacenamiento        │
│  ✅ Notas clínicas              │
│                                 │
│  [ Ver Planes ]                 │
└─────────────────────────────────┘
```

---

## 🔄 MIGRATION & EDGE CASES

### Edge Case 1: Downgrade with Active PRO Features

**Scenario**: User wants BASIC but has clinical notes

**Solution**:
1. **Check Dependencies**:
   ```typescript
   function checkDowngradeConstraints(tenant: Tenant): Constraint[] {
     const violations = [];
     
     if (hasClinicalNotes(tenant)) {
       violations.push({
         feature: 'Clinical Notes',
         count: getClinicalNotesCount(tenant),
         action: 'Data will become read-only (preserved but not editable)'
       });
     }
     
     return violations;
   }
   ```

2. **Warning Modal**:
   ```
   ┌─────────────────────────────────────────────┐
   │  ⚠️  Impacto de Downgrade                   │
   ├─────────────────────────────────────────────┤
   │                                             │
   │  Al cambiar a BASIC, perderás acceso a:     │
   │                                             │
   │  📝 Notas Clínicas (125 notas existentes)   │
   │     → Se conservarán pero no podrás         │
   │       editarlas ni crear nuevas             │
   │                                             │
   │  ✅ Tareas (23 tareas activas)              │
   │     → Se conservarán en solo lectura        │
   │                                             │
   │  📎 Archivos adjuntos (15 archivos)         │
   │     → Podrás descargarlos pero no subir     │
   │       nuevos                                │
   │                                             │
   │  ¿Estás seguro de continuar?                │
   │                                             │
   │  ☐ Entiendo que perderé estas funciones    │
   │  ☐ He exportado mis datos importantes      │
   │                                             │
   │  [ Cancelar ]    [ Confirmar Downgrade ]    │
   └─────────────────────────────────────────────┘
   ```

### Edge Case 2: Reactivating Suspended Account

**Scenario**: Account suspended for 20 days, user updates payment

**Process**:
1. User updates payment method
2. Backend charges outstanding invoice + current cycle
3. Subscription status → ACTIVE
4. All features restored immediately
5. Welcome back email sent

**UX**:
```
┌─────────────────────────────────────────────┐
│  🎉 ¡Bienvenido de vuelta!                  │
├─────────────────────────────────────────────┤
│                                             │
│  Tu suscripción ha sido reactivada.         │
│                                             │
│  Hemos procesado:                           │
│  • Factura pendiente: €79                   │
│  • Ciclo actual: €79                        │
│  • Total cargado: €158                      │
│                                             │
│  Tu próxima factura será el 8 de marzo.     │
│                                             │
│  [ Ver Recibo ]    [ Continuar ]            │
└─────────────────────────────────────────────┘
```

### Edge Case 3: Rapid Seat Fluctuation

**Scenario**: User adds 5 psychologists, then removes 3 within same billing period

**Billing Logic**:
- **Day 1**: Add 5 seats → Prorated charge
- **Day 10**: Remove 3 seats → Credit applied to account, no refund
- **Next cycle**: Billed for 2 additional seats only

**No immediate refund, credit accumulates for future bills**

---

## 📊 SUMMARY TABLE

### Complete Plan Comparison

| Feature | BASIC | PRO | CUSTOM |
|---------|-------|-----|--------|
| **Monthly Price** | €29 | €79 (2 seats) + €40/seat | Custom |
| **Annual Price** | €290 | €790 (2 seats) + €400/seat | Custom |
| **Trial** | 14 days | 14 days | Negotiated |
| **Psychologists** | 1 | 2-15 | Unlimited |
| **Assistants** | 3 | Unlimited | Unlimited |
| **Patients** | 50 | 500 | Unlimited |
| **Storage** | 2 GB | 50 GB | 500 GB+ |
| **Clinical Notes** | ❌ | ✅ | ✅ |
| **Tasks** | ❌ | ✅ | ✅ |
| **Attachments** | ❌ | ✅ | ✅ |
| **Web Push** | ❌ | ✅ | ✅ |
| **SMS** | ❌ | ❌ | ✅ |
| **Analytics** | Basic | Advanced | Custom Reports |
| **Support** | Email 48h | Email 24h | Phone + Dedicated AM |
| **API Access** | ❌ | Read-only | Full |

---

**End of Document**

**Next Steps**:
1. Backend team: Implement subscription engine
2. Frontend team: Integrate upgrade flows
3. Product team: Validate pricing with market research
4. Legal: Review terms for downgrades and data retention
