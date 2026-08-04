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

