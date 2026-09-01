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

### 7.9 Inventory acceptance tests

Verify that:

- Stock receipts update the correct location.
- Concurrent reservations cannot exceed available stock.
- Repeated requests do not create duplicate movements.
- Canceled orders release only their own eligible reservations.
- A shipment reduces stock at most once.
- Invalid cross-location movements are rejected.
- Negative stock cannot appear through ordinary operations unless explicitly supported.
- Ledger and balance totals can be reconciled.
- Every adjustment has a traceable actor and reason.

## 8. Order Management and Lifecycle

### 8.1 Order lifecycle

Define explicit operational states. A proposed initial order lifecycle is:

`pending → confirmed → processing → fulfilled`

with appropriate terminal or exceptional states such as:

`cancelled`, `partially_fulfilled`, `on_hold`

These values are a starting point, not a universal mandatory sequence. Adapt them to the actual payment and fulfillment model.

Validate transitions on the server. Do not permit a canceled order to become fulfilled merely because a user changed a status field.

### 8.2 Separate order, payment, and fulfillment states

An order's operational state must not be used as a substitute for payment status or fulfillment status.

For example:

- An order may be confirmed but unpaid under an allowed payment method.
- A payment may be authorized while fulfillment has not started.
- A payment may be captured while part of the order remains unfulfilled.
- A fulfillment may be shipped while a separate refund is pending.
- An order may have multiple payment attempts, including failed attempts.

Keep these state machines separate and define the allowed combinations and transitions.

### 8.3 Order creation

When creating an order:

1. Authenticate and authorize the request.
2. Validate store, SKU, currency, and order-line inputs.
3. Resolve the current eligible variant and price.
4. Create price and product snapshots for the order lines.
5. Calculate totals using exact arithmetic.
6. Apply applicable discounts, taxes, and shipping charges only when those features are implemented.
7. Reserve inventory according to the defined order and payment policy.
8. Persist the order, lines, reservations, and relevant audit or event records transactionally where appropriate.
9. Return the persisted order representation.

Do not trust a client-submitted total or price when the server can calculate or verify it.

### 8.4 Order cancellation

Cancellation must verify:

- The current order status.
- Whether fulfillment has started or completed.
- Whether payment was authorized or captured.
- Whether stock is reserved, shipped, or otherwise allocated.
- Whether a refund or additional financial action is required.

Release eligible unshipped reservations exactly once.

If payment was already captured, cancellation must not falsely imply that the money has been returned. Track any refund through a separate payment workflow.

### 8.5 Order history

Provide an order timeline showing important transitions, including:

- Order creation
- Confirmation
- Inventory reservation
- Payment updates
- Hold and release events
- Fulfillment allocation
- Shipment confirmation
- Cancellation
- Refund initiation and result

Each event should identify its actor or originating system, timestamp, and relevant reference.

## 9. Payment Processing and Reconciliation

Payment operations require particularly careful handling because external systems may respond asynchronously, time out, or deliver duplicate webhook events.

### 9.1 Provider abstraction

Define an internal payment-provider interface with operations appropriate to the chosen integration, such as:

- Create or initiate a payment.
- Retrieve payment status.
- Capture an authorized payment when supported.
- Initiate a refund.
- Verify an incoming provider event.
- Normalize provider responses into internal statuses.

Implement only the operations supported by the selected provider. Do not invent provider capabilities or assume that every provider supports identical authorization, capture, or refund behavior.

Use a clearly labeled test adapter for development when the real provider is unavailable.

### 9.2 Payment state

Use a documented internal payment state machine, with states such as:

`pending`, `authorized`, `captured`, `failed`, `cancelled`, `partially_refunded`, `refunded`

The exact states depend on provider capabilities and the chosen payment workflow.

Track the provider's original status separately when useful, along with the normalized internal state.

Never assume a browser redirect, frontend success message, or client-submitted payment status proves that a payment succeeded.

### 9.3 Payment initiation

For an eligible payment request:

1. Validate the order and amount.
2. Recalculate or verify the amount server-side.
3. Ensure the requested currency matches the order's payment context.
4. Create an internal payment attempt with a unique operation reference.
5. Call the configured provider using an idempotency mechanism where supported.
6. Store the provider reference and returned status.
7. Treat asynchronous or uncertain outcomes as pending until authoritative confirmation is available.

If an external call times out, do not blindly initiate another charge. First use the provider's supported idempotency and status-retrieval mechanisms to determine the outcome of the original operation.

### 9.4 Webhook verification

For a real provider integration:

- Verify the provider's event signature or equivalent authenticity mechanism.
- Validate the expected event structure.
- Store provider event IDs and deduplicate repeated deliveries.
- Process relevant events idempotently.
- Check that the event references the correct internal payment and order.
- Validate amount and currency where those values are included.
- Apply allowed state transitions.
- Record processing outcomes and failure reasons.
- Return the provider's required response according to its documented webhook contract.

Do not trust arbitrary webhook JSON simply because it contains a known-looking order ID.

Never mark an order paid through a public endpoint that accepts an unverified client-supplied boolean such as `paymentSuccessful: true`.

### 9.5 Payment and inventory coordination

Payment and inventory must be coordinated through a documented workflow.

A practical initial flow is:

1. Validate order intent.
2. Reserve the required stock.
3. Initiate payment or await an accepted payment method.
4. Confirm payment through the appropriate authoritative mechanism.
5. Advance the order state according to the policy.
6. Release reservations after eligible failures or expiration.
7. Escalate uncertain payment outcomes for reconciliation rather than releasing stock prematurely when doing so could create inconsistent order handling.

The precise sequence depends on whether payment is authorized, captured immediately, captured at shipment, or collected on delivery.

Do not attempt to treat a database transaction and an external payment call as one atomic transaction. They are separate systems. Use explicit states, idempotent operations, timeouts, reconciliation, and compensating actions.

### 9.6 Refunds

A refund request should:

1. Verify the caller's refund permission.
2. Validate the order and payment relationship.
3. Check the refundable balance.
4. Validate amount and currency.
5. Create an internal refund record.
6. Initiate the provider operation using a suitable idempotency mechanism.
7. Track the authoritative provider outcome.
8. Update normalized payment and order financial summaries as appropriate.
9. Record an audit event.

Prevent duplicate refunds for the same logical request.

A requested refund is not the same as a completed refund. Display pending, successful, failed, or uncertain outcomes accurately.

Support partial refunds only if the underlying provider and order rules permit them.

### 9.7 Payment reconciliation

Provide a workflow to identify discrepancies between internal records and authoritative provider data.

Examples include:

- A provider reports success, but the internal payment remains pending.
- A webhook was rejected or not processed.
- A refund result is unknown after a timeout.
- The captured amount does not match the expected amount.
- The internal order and provider reference do not agree.

Reconciliation must not silently overwrite financial records. Record the discrepancy, compare evidence, apply only allowed transitions, and retain an audit trail.

### 9.8 Payment security

- Never store raw card numbers or card security codes.
- Use provider-hosted payment collection or appropriately scoped provider tokenization where relevant.
- Store only the payment references and information needed for legitimate operations.
- Keep provider secrets on the server or in a managed secrets store.
- Redact credentials and sensitive payment data from logs.
- Restrict refund and payment-management permissions.
- Use TLS for external communication.
- Document any sensitive data retention and payment compliance responsibilities accurately.

Do not claim payment compliance certification merely because an external gateway is used.

## 10. Fulfillment Workflow

### 10.1 Fulfillment states

Define an explicit fulfillment state machine, such as:

`pending → picking → packed → shipped → delivered`

with supported exceptional states such as `cancelled` or `failed`.

Do not treat order status, payment status, and fulfillment status as interchangeable.

### 10.2 Picking

A picking operation should:

- Identify eligible order lines.
- Verify stock allocations and location.
- Record picked quantities.
- Handle shortages explicitly.
- Prevent picking more than the eligible ordered quantity.
- Record actor and timestamp.

For a partial pick, preserve the unfulfilled remainder rather than silently marking the entire order as ready to ship.

### 10.3 Packing and dispatch

Before dispatch:

- Confirm the eligible fulfillment quantities.
- Validate the fulfillment state.
- Record package and shipping details where supported.
- Verify the relevant stock allocation.
- Ensure that shipping confirmation is idempotent.
- Record the fulfillment transition and inventory movements together where appropriate.

### 10.4 Tracking

When shipping integration is implemented, store carrier references and tracking information.

A carrier tracking update should be verified or obtained through the relevant authorized integration. Do not treat a manually entered tracking string as proof of delivery.

### 10.5 Fulfillment exceptions

Provide a way for staff to flag and resolve issues, such as:

- Insufficient stock
- Damaged items
- Missing SKU
- Incomplete picking
- Shipping address issue
- Carrier error
- Duplicate fulfillment event
- Failed delivery

An exception should capture its status, owner if assigned, reason, and resolution history.

### 10.6 Returns and restocking

Returns and reverse logistics may be added as a defined extension.

If supported, separate the return request, physical receipt, condition inspection, restocking decision, and refund outcome.

Do not automatically restore returned products to sellable stock when the physical condition has not been verified or when the business policy requires inspection.

A return receipt and a financial refund are separate operations and should have separate state histories.

## 11. Staff Roles and Access Control

### 11.1 Initial roles

| Role | Typical permissions |
|---|---|
| Owner | Full organization control and ownership management |
| Admin | Manage staff, settings, catalog, and operations within policy |
| Catalog Manager | Manage products, variants, and catalog pricing |
| Inventory Manager | Receive stock, manage adjustments, transfers, and reconciliation |
| Order Manager | Manage order operations and permitted order transitions |
| Fulfillment Staff | Pick, pack, and dispatch eligible orders |
| Finance Staff | View payments and initiate or approve permitted refunds |
| Support Staff | View permitted order information and add authorized support notes |
| Viewer | Read permitted operational information without modifying it |

Implement the precise permission matrix in a centralized authorization layer. The table provides role intentions, not a substitute for defining individual permission decisions.

Avoid granting every employee broad Admin access.

### 11.2 Permission granularity

Define policies such as:

- `canManageCatalog`
- `canChangePrice`
- `canReceiveStock`
- `canAdjustInventory`
- `canManageReservations`
- `canViewOrder`
- `canCancelOrder`
- `canInitiateRefund`
- `canApproveRefund`
- `canDispatchFulfillment`
- `canManageStaff`
- `canViewAuditHistory`
- `canExportData`

Where operational risk justifies it, support approval rules for high-value refunds, large stock adjustments, or sensitive permission changes.

The permission system must explicitly handle self-demotion, staff removal, and the final Owner of an organization.

### 11.3 Sensitive actions

Require suitable authentication and authorization for:

- Refund initiation or approval
- Manual inventory adjustments
- Product pricing changes
- Staff role changes
- Organization settings changes
- Exporting sensitive operational data
- Canceling or overriding advanced order states

Audit all sensitive actions, including failed authorization attempts where useful.

### 11.4 Tenant isolation

A user authorized in one organization or store must not gain access to another through a crafted ID or API request.

Apply organization and store scoping to:

- Database reads and writes
- Search and autocomplete
- Bulk imports and exports
- Background jobs
- Payment records
- Inventory movements
- Audit history
- Notifications and webhooks

Background processing must carry a verified internal tenant context rather than trusting arbitrary organization identifiers from external payloads.

## 12. Auditability and Traceability

Audit history is a core business requirement.

### 12.1 Actions to record

At minimum, record:

- Product creation and updates
- SKU or barcode changes
- Price changes
- Stock receipts and adjustments
- Inventory reservation and release
- Stock transfers
- Order creation and state transitions
- Order cancellation
- Payment state changes
- Refund initiation and outcomes
- Fulfillment events
- Staff invitations, removals, and role changes
- Permission overrides
- Important configuration changes

### 12.2 Audit event content

Each event should capture:

- Actor or originating system
- Action
- Resource type and identifier
- Organization and store scope
- Timestamp
- Relevant before-and-after values
- Reason, if supplied
- Request or correlation ID
- Related external reference, when applicable

Use UTC timestamps for persisted event time, converting them for user display according to the store or user's configured timezone.

### 12.3 Audit integrity

Normal application operations should not permit staff to alter the historical audit trail.

Corrections to inventory, order, or payment state should be represented through authorized corrective operations or compensating records rather than deleting evidence of the original event.

Restrict audit access to authorized roles and avoid storing sensitive authentication secrets or prohibited payment data.

Audit history should support questions such as:

- Who changed the price?
- Why did available inventory decrease?
- Which action reserved stock for this order?
- Who canceled the order?
- What source confirmed payment?
- Was a refund requested, and what was the provider's final result?
- Which action changed the fulfillment state?

## 13. API Design and Contracts

Expose a versioned API under `/api/v1`.

Every endpoint must authenticate the caller when required, validate its inputs, enforce the correct organization and store scope, and use documented success and error contracts.

### 13.1 Catalog endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/products` | List and filter authorized products |
| POST | `/api/v1/products` | Create a product |
| GET | `/api/v1/products/:productId` | Retrieve a product |
| PATCH | `/api/v1/products/:productId` | Update permitted product fields |
| POST | `/api/v1/products/:productId/variants` | Create a variant |
| PATCH | `/api/v1/variants/:variantId` | Update permitted variant fields |
| GET | `/api/v1/variants/:variantId` | Retrieve variant details |

### 13.2 Inventory endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/inventory` | Query current inventory |
| GET | `/api/v1/inventory/:variantId` | Retrieve scoped inventory details |
| POST | `/api/v1/inventory/receipts` | Receive stock |
| POST | `/api/v1/inventory/adjustments` | Record an authorized stock adjustment |
| POST | `/api/v1/inventory/transfers` | Initiate a stock transfer if supported |
| GET | `/api/v1/inventory/movements` | Query inventory history |
| POST | `/api/v1/inventory/reconciliation` | Run a reconciliation operation |

Reconciliation should ordinarily be a controlled job or preview operation. Do not expose an endpoint that silently rewrites balances to match an unverified expected value.

### 13.3 Order endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/orders` | List and filter orders |
| POST | `/api/v1/orders` | Create an eligible order |
| GET | `/api/v1/orders/:orderId` | Retrieve order details |
| POST | `/api/v1/orders/:orderId/confirm` | Confirm an eligible order |
| POST | `/api/v1/orders/:orderId/cancel` | Cancel an eligible order |
| GET | `/api/v1/orders/:orderId/activity` | Retrieve order history |

Use explicit action endpoints or well-defined transition schemas for sensitive state changes rather than allowing unrestricted status assignment.

### 13.4 Payment endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/orders/:orderId/payments` | List authorized payment records |
| POST | `/api/v1/orders/:orderId/payments` | Create a payment attempt |
| GET | `/api/v1/payments/:paymentId` | Retrieve payment details |
| POST | `/api/v1/payments/:paymentId/refunds` | Initiate a permitted refund |
| GET | `/api/v1/refunds/:refundId` | Retrieve refund status |
| POST | `/api/v1/webhooks/payments/:provider` | Receive provider events |

Provider webhooks may use a provider-specific authentication mechanism rather than a staff session. Verify signatures and event authenticity according to the provider's documented contract.

### 13.5 Fulfillment endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/orders/:orderId/fulfillments` | List fulfillments |
| POST | `/api/v1/orders/:orderId/fulfillments` | Create an eligible fulfillment |
| GET | `/api/v1/fulfillments/:fulfillmentId` | Retrieve fulfillment details |
| POST | `/api/v1/fulfillments/:fulfillmentId/pick` | Record picking progress |
| POST | `/api/v1/fulfillments/:fulfillmentId/pack` | Mark eligible goods packed |
| POST | `/api/v1/fulfillments/:fulfillmentId/ship` | Confirm dispatch |
| POST | `/api/v1/fulfillments/:fulfillmentId/deliver` | Record delivery when supported |

These endpoints are proposed contracts. Implement and document only the workflows selected for the actual product.

### 13.6 Staff and audit endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/staff` | List permitted staff |
| POST | `/api/v1/staff/invitations` | Invite staff |
| PATCH | `/api/v1/staff/:membershipId` | Change permitted membership details |
| DELETE | `/api/v1/staff/:membershipId` | Remove staff access |
| GET | `/api/v1/audit-events` | Query authorized audit events |
| GET | `/api/v1/reports/operations` | Retrieve operational summaries |

### 13.7 Request validation

Validate:

- Path parameters
- Query parameters
- Request bodies
- Currency codes
- Monetary amounts
- Quantities
- SKU identifiers
- State transitions
- Idempotency keys
- External provider references
- Dates and timestamps
- Staff permissions

Do not allow ordinary clients to overwrite server-managed fields such as organization ownership, audit metadata, captured payment amounts, or inventory balances.

### 13.8 Consistent responses

Use a predictable response envelope.

Example:

```json
{
  "data": {
    "id": "order_example",
    "orderStatus": "processing",
    "currency": "INR",
    "totalMinor": 129900,
    "createdAt": "2026-10-25T12:00:00.000Z"
  }
}
```

This is an illustrative response with example values, not an actual transaction record.

Use a documented error envelope, including a stable error code and request ID where appropriate.

Apply HTTP status codes consistently for successful requests, validation failures, missing authentication, forbidden operations, missing or concealed resources, state conflicts, rate limits, and unexpected failures.

Do not expose stack traces, raw database errors, payment-provider secrets, or sensitive transaction details in public-facing error messages.

### 13.9 API documentation

Maintain an OpenAPI 3.x specification covering:

- Endpoints and methods
- Authentication requirements
- Role and permission requirements
- Request and response schemas
- Business validation rules
- Order and payment state transitions
- Inventory movement semantics
- Idempotency behavior
- Webhook security and processing
- Error responses
- Pagination and filtering

Validate the specification in CI where practical and keep it synchronized with the actual implementation.

## 14. Frontend and Operations Dashboard

### 14.1 Dashboard overview

Provide an operational dashboard showing useful metrics and exceptions, such as:

- Orders requiring action
- Orders awaiting fulfillment
- Low-stock products
- Recent inventory movements
- Pending or failed payment operations
- Refunds awaiting resolution
- Fulfillment exceptions
- Recent staff activity, where authorized

Label metrics clearly and derive them from real persisted records. Do not present hard-coded sample values as live operational data.

### 14.2 Catalog interface

Provide:

- Searchable product table
- Variant and SKU management
- Editable pricing fields
- Status controls
- Product detail view
- Inventory availability indicators
- Clear validation errors

Do not imply that product activation guarantees stock availability. Catalog status and inventory status represent different facts.

### 14.3 Inventory interface

Display on-hand, reserved, and available quantities separately.

Offer scoped views by SKU and location. Provide controlled operations for receiving stock, adjustments, and transfers where supported.

Every inventory adjustment should display its reason and resulting balance.

### 14.4 Order workspace

Provide:

- Search and filtering
- Order detail and line-item view
- Current order status
- Payment status and transaction references
- Fulfillment status and tracking information
- Relevant activity timeline
- Authorized cancellation or exception actions

Keep financial and fulfillment states separate and visually distinguish them.

### 14.5 Payment and refund interface

Clearly distinguish:

- Payment requested
- Payment pending
- Payment authorized
- Payment captured
- Payment failed
- Refund requested
- Refund pending
- Refund completed
- Refund failed or uncertain

Do not show a success indicator until the authoritative state supports that conclusion.

### 14.6 Permission-aware user experience

Hide or disable controls the current user cannot use, but continue enforcing authorization on the backend.

Provide understandable explanations for permission denials and validation errors without revealing sensitive information.

Confirm high-impact actions, such as inventory adjustments, cancellations, and refunds, before execution.

### 14.7 Accessibility and responsive behavior

Support keyboard navigation, readable status labels, sufficient contrast, accessible form errors, and responsive layouts.

Critical workflows such as order lookup, receiving stock, and checking payment status should remain practical on smaller screens.

## 15. Security and Privacy Requirements

### 15.1 Authentication and sessions

- Use a maintained authentication library.
- Protect staff-only endpoints.
- Configure session expiration and invalidation.
- Apply appropriate cookie security and CSRF protection where relevant to the authentication design.
- Rate-limit sensitive authentication operations.
- Never log credentials or session secrets.

### 15.2 Authorization

- Enforce permissions on every protected operation.
- Scope data reads and writes to authorized organizations and stores.
- Prevent insecure direct object reference vulnerabilities.
- Enforce approval policies for sensitive operations where configured.
- Ensure removed staff lose access on subsequent protected requests.
- Avoid trusting client-supplied role or ownership fields.
- Authorize access to exports, payment details, inventory history, and audit events separately where necessary.

### 15.3 Inventory and financial integrity

- Enforce stock invariants through transactions and database constraints.
- Prevent duplicate inventory movement.
- Prevent unauthorized manual stock changes.
- Prevent duplicate payment operations where idempotency is supported.
- Validate provider events before changing internal financial state.
- Prevent refund amounts from exceeding the verified refundable amount.
- Preserve the original evidence of canceled, reversed, or corrected operations.

### 15.4 External integrations

- Store provider credentials in environment secrets or an appropriate secret manager.
- Verify signatures or equivalent authenticity mechanisms for webhooks.
- Use bounded retries and request timeouts.
- Apply appropriate outbound request protections.
- Validate all external payloads.
- Avoid using an external event as unquestioned authority over unrelated internal data.
- Record integration failures and reconciliation outcomes.

### 15.5 Database and logging

- Use parameterized database operations or safe ORM queries.
- Apply foreign-key constraints and suitable isolation strategies.
- Restrict database privileges to the permissions required by the application.
- Avoid logging payment credentials, raw authentication headers, and unnecessary personal data.
- Use request IDs for diagnostic correlation.
- Configure production CORS narrowly where cross-origin requests are needed.
- Use TLS for production traffic.
- Keep development and production configuration separate.

## 16. Reliability, Idempotency, and Failure Recovery

### 16.1 Idempotent mutations

Operations that may be retried must not accidentally repeat business effects.

Examples include:

- Stock receipts
- Inventory adjustments
- Stock reservations and releases
- Shipment confirmation
- Payment initiation
- Refund requests
- Webhook processing
- External order imports

Use idempotency keys or unique source-event references where appropriate. Store the key with enough context to determine whether the same logical operation has already been processed.

A retry with the same key must return or recover the previous operation's result where supported, rather than performing the action again.

### 16.2 Transaction boundaries

Use database transactions for logically atomic internal operations, such as:

- Reserving inventory and updating the associated order state
- Posting an inventory movement and updating its balance
- Confirming a shipment and recording associated stock deductions
- Committing an order change and its audit/outbox record

External provider calls cannot be rolled back by a PostgreSQL transaction. Use explicit internal states, idempotency, reconciliation, and compensating actions to coordinate across system boundaries.

### 16.3 Outbox and background processing

Use a transactional outbox when important state changes must also publish events or trigger downstream work.

A worker should:

- Claim eligible records safely.
- Process each event using idempotent handlers.
- Record attempts and outcomes.
- Apply bounded retries with appropriate backoff.
- Route persistent failures to a reviewable failed-job state or dead-letter mechanism.
- Avoid holding database transactions open during slow external calls.

### 16.4 Timeouts and uncertain outcomes

A request timeout does not prove that an external operation failed.

For example, a timed-out refund request may still have been accepted by the provider.

When the outcome is uncertain:

1. Preserve an explicit pending or uncertain state.
2. Use provider-supported lookup or idempotency mechanisms.
3. Process authoritative callbacks or webhooks.
4. Reconcile the operation.
5. Avoid initiating duplicate charges, refunds, or stock movements.

### 16.5 Inventory invariant checks

Provide a scheduled or on-demand reconciliation process that compares inventory balances to ledger-derived results.

Detect:

- Negative available stock
- Reserved quantities inconsistent with active reservations
- Duplicate movements
- Missing movement references
- Shipment quantities that exceed eligible allocations
- Mismatched location or SKU relationships

Report discrepancies with relevant context and do not silently rewrite financial or inventory history.

## 17. Testing Strategy

Testing must verify both ordinary workflows and the failure scenarios that can create financial or inventory inconsistencies.

### 17.1 Unit tests

Test:

- Catalog validation
- SKU uniqueness rules
- Exact monetary arithmetic
- Order total calculations
- Order state transitions
- Payment state transitions
- Refund limits
- Inventory availability calculations
- Reservation and release rules
- Fulfillment quantity limits
- Role and permission policies
- Idempotency semantics
- Provider status normalization

### 17.2 Integration tests

Use a real test database or an environment that exercises actual database constraints and transaction behavior.

Test:

- Product and variant creation
- Price updates and historical order snapshots
- Inventory receipts
- Concurrent stock reservation
- Reservation release on cancellation
- Duplicate receipt and shipment requests
- Order creation and cancellation
- Payment attempts and normalized state updates
- Duplicate and invalid webhooks
- Refund initiation and retry behavior
- Partial fulfillment
- Inventory reconciliation
- Audit event creation
- Cross-organization and cross-store isolation

### 17.3 Security tests

Verify that:

1. A staff member cannot access another organization's records without permission.
2. Staff cannot elevate their own role.
3. A Viewer cannot perform write operations.
4. Unauthorized users cannot adjust inventory.
5. Unauthorized users cannot initiate refunds.
6. Payment webhooks without valid authentication are rejected.
7. Crafted requests cannot overwrite server-controlled financial fields.
8. Search and exports respect organization boundaries.
9. Removed staff cannot access protected data.
10. Error messages and logs do not leak secrets or sensitive payment information.

### 17.4 Concurrency and idempotency tests

Verify that:

- Two simultaneous orders cannot reserve more stock than is available.
- A repeated receipt does not add stock twice.
- A repeated cancellation does not release the same reservation twice.
- Repeated shipment events do not deduct stock twice.
- Duplicate webhooks do not duplicate payment state transitions.
- A retried refund request does not initiate an unintended second refund.
- Concurrent inventory adjustments preserve the correct ledger and balance.
- A failed transaction leaves no partially applied internal operation.
- An external timeout preserves an uncertain state rather than causing a duplicate operation.

### 17.5 End-to-end tests

Using Playwright or an equivalent tool, verify these full workflows:

1. An Admin creates a product and a sellable variant.
2. An Inventory Manager receives stock.
3. The dashboard shows the resulting stock balance.
4. An eligible order is created.
5. Inventory is reserved correctly.
6. The payment workflow enters an appropriate state.
7. An authorized operator processes fulfillment.
8. Shipment confirmation changes inventory exactly once.
9. The order history displays the relevant transitions.
10. A permitted Finance user initiates a refund.
11. The refund status reflects the actual result supplied by the payment adapter.
12. A Viewer is denied inventory adjustment and refund actions.
13. A second organization cannot access the first organization's records.
14. An operational failure produces a reviewable error instead of corrupting state.

Use deterministic test adapters for automated tests. A mocked payment provider validates application behavior, not the availability or correctness of a real payment service.

## 18. Repository Structure

Use a maintainable structure similar to the following, adapted to the selected framework:

```text
ecommerce-operations/
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   ├── catalog/
│   │   ├── inventory/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── fulfillment/
│   │   ├── staff/
│   │   ├── audit/
│   │   └── api/
│   │       └── v1/
│   ├── components/
│   ├── features/
│   │   ├── catalog/
│   │   ├── inventory/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── fulfillment/
│   │   ├── staff/
│   │   └── audit/
│   ├── server/
│   │   ├── auth/
│   │   ├── authorization/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── validation/
│   │   ├── errors/
│   │   ├── integrations/
│   │   │   ├── payments/
│   │   │   └── shipping/
│   │   └── idempotency/
│   ├── db/
│   │   ├── schema/
│   │   ├── migrations/
│   │   └── client.ts
│   └── lib/
├── workers/
│   ├── outbox/
│   ├── payments/
│   ├── reconciliation/
│   └── fulfillment/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── security/
│   ├── concurrency/
│   └── e2e/
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── authorization-matrix.md
│   ├── inventory-invariants.md
│   ├── payment-lifecycle.md
│   ├── fulfillment-workflows.md
│   └── openapi.yaml
├── scripts/
├── .env.example
├── README.md
└── package.json
```

Separate provider-specific code from internal payment and fulfillment state machines. Keep inventory calculations and order transitions independently testable.

## 19. Implementation Roadmap

### Phase 1: Foundation and Access Control

- Inspect the existing repository, framework, dependencies, routes, and scripts.
- Establish environment configuration and database connectivity.
- Implement authentication and organization/store membership.
- Define roles and permission policies.
- Create schema migrations and initial indexes.
- Add request validation and consistent error handling.
- Implement tenant-scoped access and baseline security tests.

**Exit criterion:** Staff can access only the organizations and stores permitted by the backend, and the database schema is reproducible.

### Phase 2: Catalog Management

- Implement products and variants.
- Enforce SKU uniqueness.
- Add product status and pricing.
- Add search, filtering, and pagination.
- Record important catalog and price changes.
- Add historical order snapshot support in the data model.

**Exit criterion:** Authorized staff can maintain the catalog without breaking existing inventory or historical order references.

### Phase 3: Inventory Ledger and Reservations

- Implement stock balances and movement records.
- Add receiving and adjustment workflows.
- Implement concurrency-safe reservations.
- Add reservation releases.
- Introduce movement idempotency.
- Add inventory reconciliation.
- Test concurrent reservations and ledger consistency.

**Exit criterion:** Inventory movements are traceable, available stock is calculated consistently, and concurrent requests cannot silently over-reserve inventory.

### Phase 4: Order Management

- Implement order creation and order lines.
- Calculate and snapshot totals.
- Add order state transitions.
- Link orders to inventory reservations.
- Implement cancellation rules.
- Add order activity history.
- Test order and inventory transaction boundaries.

**Exit criterion:** Orders progress through validated states while preserving price snapshots and inventory consistency.

### Phase 5: Payments and Refunds

- Define the provider adapter interface.
- Implement a clearly labeled test adapter.
- Add payment attempts and payment state tracking.
- Implement signature verification and webhook deduplication.
- Add refund workflow and idempotency.
- Implement uncertain-outcome handling and reconciliation.
- Document the supported provider's actual capabilities.

**Exit criterion:** Payment records reflect verified provider outcomes, duplicate events do not duplicate operations, and unknown results are handled safely.

### Phase 6: Fulfillment and Auditability

- Implement picking, packing, and shipment confirmation.
- Add fulfillment quantity validation.
- Link shipment events to inventory movements.
- Implement task and exception handling for operational failures.
- Add complete audit records for important changes.
- Test repeat shipment events and partial fulfillment.

**Exit criterion:** Fulfillment and stock deductions remain consistent, and operators can reconstruct relevant operational history.

### Phase 7: Dashboard and Reporting

- Build the operational dashboard.
- Add catalog, inventory, order, payment, and fulfillment interfaces.
- Implement search and filtering.
- Add permission-aware actions and confirmation dialogs.
- Show processing, success, failure, and uncertain states clearly.
- Add reports and exception views based on actual records.

**Exit criterion:** Staff can complete the core workflows through the UI without relying on direct database manipulation or undocumented procedures.

### Phase 8: Hardening and Release

- Run linting, type checking, builds, migrations, and all available tests.
- Review tenant isolation and sensitive permissions.
- Test concurrency and idempotency cases.
- Verify payment webhook handling using the supported provider's test environment where available.
- Confirm logging and secrets handling.
- Document setup, deployment, and operational recovery.
- Produce a factual verification report.

**Exit criterion:** The core workflows are tested, critical data-integrity risks are resolved, and known limitations are documented.

## 20. Acceptance Criteria

### Catalog

- Products and variants can be created and updated by authorized staff.
- SKU uniqueness is enforced.
- Price updates do not rewrite historical order totals.
- Archived products remain interpretable in existing orders and inventory history.

### Inventory

- On-hand, reserved, and available quantities have explicit meanings.
- Receipts, reservations, releases, adjustments, and shipments create appropriate movements.
- Concurrent operations preserve inventory invariants.
- Duplicate requests do not duplicate stock changes.
- Balance-to-ledger reconciliation can identify discrepancies.

### Orders

- Orders contain consistent line items and monetary snapshots.
- State transitions are validated.
- Cancellation follows explicit inventory and payment rules.
- Order history explains meaningful lifecycle changes.

### Payments

- Payment state follows verified provider results or a clearly defined test adapter.
- Duplicate webhooks are safely handled.
- Unknown outcomes are not reported as successful or failed without evidence.
- Refund amounts and permissions are validated.
- Sensitive payment credentials are not stored in application data.

### Fulfillment

- Fulfillment quantities cannot exceed eligible quantities.
- Shipment confirmation updates stock at most once.
- Partial fulfillment is represented accurately where supported.
- Exceptions and corrective actions are traceable.

### Security and auditability

- Staff roles are enforced on the backend.
- Organization and store boundaries are tested.
- Sensitive operations are audited.
- Historical records cannot be silently rewritten through normal application operations.
- Search, exports, background processing, and integrations respect authorization rules.

### Engineering quality

- Database migrations work from a clean setup.
- API contracts match the implementation.
- Unit, integration, security, concurrency, and end-to-end tests cover critical workflows.
- Configuration and setup instructions are documented.
- Actual verification results and unresolved issues are reported honestly.

## 21. README and Developer Documentation

The README must include:

- Project purpose and supported operational workflows
- Architecture diagram
- Technology stack
- Prerequisites
- Environment-variable reference
- Local setup and startup commands
- Database creation and migration commands
- Development, lint, type-check, and build commands
- Unit, integration, security, concurrency, and end-to-end test commands
- Inventory data model and ledger invariants
- Order, payment, and fulfillment state machines
- Authentication and permission matrix
- Provider adapter configuration
- Webhook verification and reconciliation behavior
- Audit history and data-retention policy
- Deployment instructions
- Backup and recovery expectations
- Known limitations and future improvements

Provide `.env.example` with placeholders. Never commit actual provider secrets, session keys, or production database credentials.

## 22. Risks and Trade-offs

**Inventory overselling:** Concurrent orders can reserve the same stock if availability checking and reservation are not atomic. Use transactional inventory updates, constraints, and concurrency tests.

**Duplicate external events:** Providers and external systems may retry callbacks. Use event deduplication, idempotent handlers, and stable provider references.

**Financial uncertainty:** A timeout does not prove a payment or refund failed. Maintain explicit pending or uncertain states and reconcile with authoritative provider data.

**Incorrect historical records:** Editing a product price or deleting a product can make previous orders difficult to understand. Store order snapshots and retain relevant historical references.

**Staff privilege misuse:** Broad permissions can expose sensitive financial and operational controls. Use granular permissions, auditable sensitive actions, and approval policies where appropriate.

**Broken inventory history:** Directly overwriting balances makes discrepancies difficult to explain. Maintain a movement ledger and use compensating records for corrections.

**Partial fulfillment inconsistency:** A shipment may cover only part of an order. Represent fulfilled quantities and remaining obligations explicitly instead of assuming an order is all-or-nothing.

**Premature infrastructure complexity:** Separate microservices and distributed workflows increase operational overhead. Begin with a modular application, PostgreSQL transactions, provider adapters, and durable background processing where needed.

## 23. Final Verification Report

At completion, produce a report containing:

| Area | Required evidence |
|---|---|
| Catalog | Product, variant, SKU, and pricing tests |
| Inventory | Ledger integrity, reservations, adjustments, and reconciliation |
| Orders | Creation, state transitions, cancellations, and snapshots |
| Payments | Provider adapter, webhook verification, and idempotency behavior |
| Refunds | Permission checks, amount validation, and provider outcome tracking |
| Fulfillment | Picking, packing, shipping, and duplicate-event handling |
| Staff access | Role matrix and denied-operation tests |
| Audit history | Recorded actions and traceable corrections |
| API | Implemented endpoints and documentation status |
| Testing | Actual commands executed and results |
| Security | Findings and unresolved risks |
| Deployment | Actual deployment status and configuration requirements |
| Final status | Ready for submission, blocked, or incomplete, with evidence |

Clearly distinguish implemented features from planned features. State whether a real provider integration was tested or whether testing used a simulated adapter. Do not claim a successful production transaction when only the internal workflow was tested.

## Final Execution Instruction

Inspect the existing codebase before making changes. Preserve working functionality unless a change is necessary and justified. Implement the platform incrementally, prioritizing inventory correctness, explicit state transitions, secure staff permissions, idempotent operations, and traceable history.

Keep catalog, inventory, order, payment, and fulfillment state models distinct, while defining the transactions and business rules that connect them.

Every inventory adjustment must be explainable. Every order mutation must follow a validated transition. Every payment result must be based on an authoritative provider result or a clearly identified test adapter. Every sensitive staff operation must be authorized and audited.

Do not implement direct balance overwrites as a substitute for inventory movements. Do not assume external payment calls are transactionally atomic with database changes. Do not treat a successful request submission as proof that payment, refund, or shipment has completed.

Before declaring completion, run the actual available linting, type-checking, build, database migration, unit, integration, security, concurrency, and end-to-end commands. Verify the important frontend and backend workflows against the running application wherever possible.

Report failures, limitations, unverified integrations, and unresolved risks honestly.

The final deliverable must demonstrate that e-commerce staff can manage catalog data, maintain accurate inventory, process orders and fulfillment reliably, track financial operations, enforce role-based access, and reconstruct important operational changes from an auditable history.