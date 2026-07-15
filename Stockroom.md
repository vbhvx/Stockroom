# Technical Specification: Secure E-Commerce Operations and Inventory Management Platform

**Project Type:** Full-Stack E-Commerce Operations SaaS / Internal Administration Platform  
**Primary Focus:** Product Catalogs, Inventory Control, Order Management, Payment Reconciliation, Fulfillment Workflows, Staff Access Control, and Audit Trails  
**Target Users:** E-commerce operators, store owners, inventory managers, fulfillment teams, finance staff, and customer support teams  
**Engineering Objective:** Build a secure, traceable operational core that centralizes essential commerce workflows, preserves inventory accuracy, controls staff access, and provides a reliable record of every important business operation.

## 1. Objective

Develop a centralized e-commerce operations platform that enables a business to manage its product catalog, inventory, orders, payment states, fulfillment workflows, and staff permissions through a consistent interface and documented API.

The application should replace disconnected operational spreadsheets, inconsistent internal tools, and fragile custom integrations with a system that provides reliable data, controlled state transitions, and traceable changes.

The central engineering challenge is not simply implementing product and order CRUD operations. It is maintaining correct relationships between inventory, orders, payment records, fulfillment events, and staff actions when requests fail, operations are retried, or multiple people work simultaneously.

The finished application must allow authorized staff to:

1. Create and maintain products, SKUs, variants, pricing information, and catalog metadata.
2. Track stock levels and inventory movements across one or more locations.
3. Reserve available stock for eligible orders and release reservations when required.
4. Process orders through explicit, validated operational states.
5. Track payment attempts, confirmations, failures, refunds, and reconciliation discrepancies.
6. Manage picking, packing, shipping, cancellations, and fulfillment exceptions.
7. Assign staff roles and restrict access to sensitive operational functions.
8. Record important changes in an auditable history.
9. Search and filter products, inventory, orders, payments, and fulfillment records.
10. Integrate with payment providers and other external systems through clearly defined adapters.
11. Recover from duplicate requests, delayed webhooks, failed external calls, and concurrent inventory updates.
12. Expose reliable, documented APIs for the dashboard and future integrations.

**Core principle:** Every inventory movement must be explainable, every order and payment must have a well-defined lifecycle, every sensitive action must be authorized, and every important operational change must leave a traceable record.

## 2. Product Scope

Build an internal operations platform first. A complete public storefront, marketing website, recommendation engine, advanced pricing engine, and marketplace architecture are not required for the initial release.

### 2.1 Core modules

| Module | Main responsibility |
|---|---|
| Catalog | Manage products, variants, SKUs, and product status |
| Inventory | Track on-hand, reserved, and available stock |
| Orders | Manage order records, line items, and lifecycle transitions |
| Payments | Track payment attempts, provider events, and refunds |
| Fulfillment | Coordinate picking, packing, shipping, and dispatch |
| Staff and access | Authenticate staff and enforce role-based permissions |
| Audit history | Record important operational changes |
| Reporting | Provide operational summaries and exception visibility |
| Integrations | Connect external services through explicit provider adapters |

### 2.2 Initial assumptions

The implementation should use the following initial assumptions unless the existing product requirements specify otherwise:

- The application serves one or more merchant organizations.
- An organization may manage one or more stores.
- Products can have variants, with each sellable variant represented by a unique SKU within the applicable catalog scope.
- Inventory can be tracked by warehouse or stock location.
- Orders may originate from the application's internal workflow or an explicitly implemented integration.
- Payment processing is delegated to a supported payment provider.
- Staff access is restricted by organization, store, and operational role as applicable.
- Development environments may use clearly labeled test data and simulated provider responses.

Do not claim to support a specific commerce platform, payment gateway, shipping carrier, or accounting service until its adapter is actually implemented and verified.

## 3. System Architecture

Use a modular, TypeScript-first application architecture with a relational database as the source of truth for internal operational state.

```text
Staff Dashboard / Authorized API Client
                  |
                  v
        Authentication and Sessions
                  |
                  v
       Authorization and Tenant Scope
                  |
                  v
        Input Validation and API Layer
                  |
                  v
          Application Services
                  |
       +----------+-----------+
       |          |           |
       v          v           v
    Catalog   Inventory     Orders
                  |           |
                  v           v
             Stock Ledger  Payments
                  |           |
                  +-----+-----+
                        |
                        v
                  Fulfillment
                        |
                        v
                 PostgreSQL
                        |
              +---------+---------+
              |                   |
              v                   v
        Audit / Outbox      Reconciliation
              |                   |
              v                   v
       Events / Workers     Exception Reports
              |
              v
    External Provider Adapters
    Payment / Shipping / Commerce
```

### Architectural responsibilities

**Frontend:** Presents operational workflows, captures staff actions, communicates save and processing states, and displays errors and exceptions.

**API layer:** Authenticates requests, validates input, scopes requests to the correct organization and store, and enforces consistent API contracts.

**Application services:** Implement business rules for catalog changes, reservations, order transitions, payment updates, fulfillment, and refunds.

**Database:** Stores the authoritative catalog, inventory state, order records, payment records, and operational history.

**Inventory ledger:** Records stock movements in an append-oriented history so current inventory can be explained and reconciled.

**Provider adapters:** Translate provider-specific requests and events into the application's internal contracts.

**Background workers:** Process retryable operations, notifications, integration events, and reconciliation jobs.

**Audit and outbox:** Preserve evidence of important changes and support reliable publication of events after database transactions commit.

Keep business logic independent of frontend components and specific third-party providers. A payment provider outage must not make the catalog unreadable or prevent staff from inspecting existing order records.

## 4. Recommended Technical Stack

| Layer | Recommended technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS and accessible UI primitives |
| Backend | Next.js route handlers or a dedicated Node.js API |
| Database | PostgreSQL |
| ORM | Drizzle ORM or Prisma |
| Validation | Zod or an equivalent runtime schema validator |
| Authentication | Maintained authentication and session library |
| API documentation | OpenAPI 3.x |
| Background jobs | Queue and worker system where asynchronous processing is justified |
| Testing | Vitest or Jest, with HTTP integration tests |
| End-to-end testing | Playwright |
| API testing | Postman or automated API contract tests |
| Deployment | Supported application hosting with managed PostgreSQL |
| Observability | Structured logs, request IDs, operational metrics, and health checks |

Choose one primary ORM and one backend architecture. Do not introduce separate services, brokers, or databases without a concrete reliability or scaling requirement.

The initial release can run as a modular monolith with PostgreSQL transactions and a background worker. This is generally easier to test and operate than prematurely distributing the core business rules across multiple services.

## 5. Domain Model and Data Integrity

The application must model commerce entities explicitly instead of keeping only the latest status or quantity in loosely related tables.

### 5.1 Organization and store

**Organization**

- `id`
- `name`
- `slug`
- `createdAt`
- `updatedAt`

**Store**

- `id`
- `organizationId`
- `name`
- `currency`
- `timezone`
- `status`
- `createdAt`
- `updatedAt`

Use organization and store scopes consistently throughout the application.

A staff member's access to one store must not automatically grant access to every store unless the permission policy explicitly allows it.

Currency should be stored using a standardized currency code. Do not use floating-point numbers for monetary amounts.

### 5.2 Staff user and membership

**User**

- `id`
- `email`
- `name`
- Authentication identity reference
- `createdAt`
- `updatedAt`

**StaffMembership**

- `id`
- `organizationId`
- `storeId`, where applicable
- `userId`
- `role`
- `status`
- `createdAt`
- `updatedAt`

Enforce uniqueness for the relevant membership scope.

Access must be determined from the authenticated identity and current membership. A role or organization ID supplied by a client is never proof of authorization.

### 5.3 Product

**Product**

- `id`
- `organizationId`
- `name`
- `slug`
- `description`
- `brand`
- `status`
- `createdAt`
- `updatedAt`
- `archivedAt`

Recommended product statuses:

`draft`, `active`, `archived`

The application's internal product status should not automatically imply that an item is available for sale through an external storefront. Publishing and sales-channel availability should be modeled separately if required.

### 5.4 Product variant and SKU

**ProductVariant**

- `id`
- `organizationId`
- `productId`
- `sku`
- `barcode`
- `variantAttributes`
- `unitOfMeasure`
- `weight`
- `status`
- `createdAt`
- `updatedAt`

A product may have multiple variants, such as different sizes or colors. Each independently stocked variant should have its own SKU.

Enforce SKU uniqueness within the relevant merchant or catalog scope.

Validate variant attributes and prevent duplicate variants where the product configuration requires uniqueness.

### 5.5 Product price

**ProductPrice**

- `id`
- `storeId`
- `variantId`
- `currency`
- `amountMinor`
- `effectiveFrom`
- `effectiveTo`
- `createdAt`

Represent money using integer minor units or another exact decimal representation. For example, a price of 1,299.00 in a two-decimal currency can be represented as 129,900 minor units.

Do not assume that every currency uses two decimal places. Use currency-aware formatting and a documented amount representation.

Store the applicable price and currency snapshot on each order line so historical orders remain interpretable after a product's price changes.

### 5.6 Inventory location

**InventoryLocation**

- `id`
- `organizationId`
- `storeId`
- `name`
- `locationCode`
- `status`
- `createdAt`
- `updatedAt`

A location may represent a warehouse, stockroom, fulfillment center, or another defined stock-holding area.

The initial release can support one location while retaining a data model that can represent more than one.

### 5.7 Inventory balance

**InventoryBalance**

- `id`
- `organizationId`
- `locationId`
- `variantId`
- `onHand`
- `reserved`
- `version`
- `updatedAt`

Enforce uniqueness on the applicable `(locationId, variantId)` pair.

Maintain nonnegative quantities for inventory operations unless the product explicitly supports backorders or negative stock.

Calculate available stock using a documented invariant:

\[
\text{Available} = \text{On Hand} - \text{Reserved}
\]

The inventory ledger is the historical record of movements, while the balance is the operational state optimized for current availability checks.

The two must be reconcilable.

### 5.8 Inventory movement ledger

**InventoryMovement**

- `id`
- `organizationId`
- `locationId`
- `variantId`
- `movementType`
- `quantityDelta`
- `referenceType`
- `referenceId`
- `reason`
- `actorId`
- `idempotencyKey`
- `createdAt`

Possible movement types include:

- `receipt`
- `reservation`
- `reservation_release`
- `shipment`
- `adjustment`
- `return`
- `transfer_in`
- `transfer_out`
- `correction`

Use movement-specific validation so each operation has an unambiguous interpretation. A reservation may change reserved quantity without changing on-hand quantity, whereas shipping normally reduces both on-hand and reserved quantities for the corresponding allocation.

Do not treat all movement types as identical quantity subtraction.

The exact calculation depends on the movement's business meaning. Document the invariants for every supported movement type.

Do not ordinarily edit or delete historical movements to correct a stock error. Record an auditable compensating movement.

### 5.9 Order

**Order**

- `id`
- `organizationId`
- `storeId`
- `orderNumber`
- `source`
- `orderStatus`
- `currency`
- `subtotalMinor`
- `discountMinor`
- `taxMinor`
- `shippingMinor`
- `totalMinor`
- `customerReference`
- `idempotencyKey`
- `createdAt`
- `updatedAt`
- `cancelledAt`

Use a unique order number within the applicable store or organization scope.

An order should preserve the relevant commercial information as it existed when the order was placed or imported.

### 5.10 Order line

**OrderLine**

- `id`
- `orderId`
- `variantId`
- `skuSnapshot`
- `productNameSnapshot`
- `quantityOrdered`
- `unitPriceMinor`
- `discountMinor`
- `taxMinor`
- `lineTotalMinor`
- `createdAt`

The snapshot fields preserve historical order information even if the catalog later changes.

For orders that support partial fulfillment, track quantities fulfilled, canceled, or otherwise resolved through explicit records or well-defined aggregate fields.

Validate that line quantities are positive and that all arithmetic uses exact monetary representations.

### 5.11 Payment

**Payment**

- `id`
- `organizationId`
- `orderId`
- `provider`
- `providerPaymentId`
- `paymentStatus`
- `currency`
- `authorizedAmountMinor`
- `capturedAmountMinor`
- `refundedAmountMinor`
- `createdAt`
- `updatedAt`

An order may have more than one payment attempt or payment record, depending on the supported workflow.

Do not store raw card numbers, security codes, or other prohibited payment credentials in application tables or logs.

### 5.12 Refund

**Refund**

- `id`
- `organizationId`
- `paymentId`
- `providerRefundId`
- `idempotencyKey`
- `amountMinor`
- `currency`
- `status`
- `reason`
- `requestedBy`
- `createdAt`
- `updatedAt`

The provider's actual refund result must be tracked separately from the original refund request.

Enforce amount and currency constraints and prevent duplicate successful refunds for the same logical request.

### 5.13 Fulfillment

**Fulfillment**

- `id`
- `organizationId`
- `orderId`
- `locationId`
- `status`
- `carrier`
- `trackingNumber`
- `shippedAt`
- `deliveredAt`
- `createdAt`
- `updatedAt`

**FulfillmentLine**

- `id`
- `fulfillmentId`
- `orderLineId`
- `quantity`
- `createdAt`

Support partial fulfillment when required, ensuring that the total allocated quantities cannot exceed the quantities that are eligible to be fulfilled.

### 5.14 Audit event

**AuditEvent**

- `id`
- `organizationId`
- `storeId`
- `actorId`
- `action`
- `resourceType`
- `resourceId`
- `beforeState`
- `afterState`
- `reason`
- `requestId`
- `createdAt`

Record important business changes, including inventory adjustments, product changes, cancellations, refunds, staff permission changes, and fulfillment transitions.

Audit history should not contain payment credentials, session tokens, or unnecessary sensitive personal information.

### 5.15 Constraints and indexes

Implement:

- Foreign-key constraints
- Unique SKU and order-number constraints
- Unique provider event IDs within their applicable scope
- Unique idempotency keys where required
- Nonnegative quantity constraints where applicable
- Monetary amount and currency validation
- Indexes on common lookup and filtering fields
- Transactional updates for related operational records

Use database constraints as an additional protection layer, not as a substitute for business-level validation.

## 6. Catalog Management

### 6.1 Product lifecycle

Implement the following basic operations:

- Create a product.
- Edit product information.
- Add, edit, and deactivate variants.
- Manage SKU and barcode information.
- Set prices by store or supported price scope.
- Search and filter the catalog.
- Archive products.
- View product history where appropriate.

### 6.2 Catalog rules

- A SKU must identify the relevant sellable variant uniquely within its defined scope.
- A product with active inventory must not be deleted in a way that breaks inventory history or existing orders.
- Historical order lines must retain their product and pricing snapshots.
- Archiving a product must not remove its past order or stock movement records.
- Product status changes must not implicitly adjust inventory.
- Price changes must not silently rewrite historical order totals.

### 6.3 Bulk operations

Bulk import and export may be included as a practical operational feature.

If implemented, validate each row and produce an actionable import report containing success counts, rejected rows, and validation errors.

Use a preview-and-confirm flow for destructive or large-scale catalog changes. Bulk operations must follow the same permission checks and audit rules as individual changes.

Do not silently accept conflicting SKUs or partially apply a large import without reporting the resulting state.

## 7. Inventory Control and Stock Accuracy

Inventory correctness is one of the platform's primary acceptance criteria.

### 7.1 Inventory quantities

Maintain explicit definitions:

- **On hand:** Quantity physically recorded at the location.
- **Reserved:** Quantity allocated to eligible orders but not yet shipped.
- **Available:** On-hand quantity minus reserved quantity.
- **Fulfilled:** Quantity that has left the relevant stock location through a confirmed shipment or the documented equivalent.
- **Incoming:** Optional quantity expected from purchase orders or stock transfers, not necessarily sellable yet.

Do not mix expected incoming stock with available sellable stock unless the application explicitly supports preorders or backorders.

### 7.2 Stock receiving

A stock receipt should:

1. Authenticate and authorize the operator.
2. Validate the SKU, location, and quantity.
3. Check the associated reference, such as a receipt record, when supported.
4. Create an inventory movement.
5. Update the inventory balance within a transaction.
6. Record the actor and reason.
7. Return the resulting balance.

Repeating the same logical receipt request must not accidentally add the same stock twice. Use an idempotency key or an equivalent reference-based deduplication strategy.

### 7.3 Stock reservations

An eligible order may reserve inventory before fulfillment.

Reservation should:

- Verify order eligibility.
- Determine the relevant SKU and stock location.
- Confirm sufficient available quantity.
- Reserve stock atomically.
- Record the inventory movement and allocation.
- Update the order's operational state according to its current stage.

Concurrent order creation must not over-reserve inventory.

The inventory service must use an appropriate database transaction, row lock, conditional update, or equivalent concurrency-safe mechanism. A separate availability check followed by an unprotected update is not sufficient.

### 7.4 Reservation release

Release reserved stock when a supported workflow requires it, such as an eligible cancellation or an explicitly defined reservation-expiration process.

The release must be idempotent. A retry must not release the same quantity twice.

Do not release stock merely because a delayed event is received. Verify the current order and reservation state before applying the movement.

### 7.5 Shipment and stock deduction

When an eligible fulfillment is confirmed as shipped:

1. Verify the order and fulfillment state.
2. Verify the relevant stock allocation.
3. Confirm the quantities being fulfilled.
4. Deduct the appropriate on-hand and reserved amounts.
5. Record inventory movements.
6. Update fulfillment and order state.
7. Write audit and event records.

Use a transaction to keep the inventory changes and corresponding internal state consistent.

Do not deduct stock twice when a shipping webhook or staff request is retried.

### 7.6 Inventory adjustments

Authorized inventory managers should be able to perform controlled stock adjustments.

Require:

- SKU
- Location
- Quantity change
- Reason
- Actor identity
- Reference or supporting note where appropriate

High-impact adjustments may require additional approval according to the configured policy.

An adjustment must generate an inventory movement and audit record. Do not permit direct, unexplained overwriting of stock balances through an ordinary CRUD endpoint.

### 7.7 Multi-location inventory

If multiple warehouses are supported, each stock balance must be location-specific.

A stock transfer should produce linked outgoing and incoming movements, with an explicit transfer state if the application needs to represent stock in transit.

For example:

`requested → in_transit → received`

Do not mark stock as received at the destination before the receiving operation has been confirmed.

### 7.8 Reconciliation

Provide a reconciliation workflow that compares calculated inventory state with stored inventory balances.

For each SKU and location, compare:

- Current balance
- Ledger-derived balance
- Active reservations
- Outstanding fulfillment allocations
- Recent movements

Flag discrepancies for investigation rather than silently correcting them.

If a repair is authorized, record a compensating movement with an explicit reason and preserve the original discrepancy evidence.

