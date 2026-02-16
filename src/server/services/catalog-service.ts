import { db } from "@/db/client";
import { products, productVariants, productPrices, inventoryBalances } from "@/db/schema";
import { eq, and, sql, desc, ilike, or } from "drizzle-orm";
import { ConflictError, NotFoundError, ValidationError } from "../errors/app-error";
import { AuditService } from "./audit-service";

export interface CreateProductInput {
  name: string;
  slug: string;
  description?: string;
  brand?: string;
  status?: "draft" | "active" | "archived";
}

export interface CreateVariantInput {
  sku: string;
  barcode?: string;
  variantAttributes?: Record<string, string>;
  unitOfMeasure?: string;
  weight?: number;
  status?: "active" | "inactive" | "discontinued";
  price?: {
    storeId: string;
    currency: string;
    amountMinor: number;
  };
}

export class CatalogService {
  static async createProduct(organizationId: string, input: CreateProductInput, actorId: string) {
    const id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const [product] = await db
      .insert(products)
      .values({
        id,
        organizationId,
        name: input.name,
        slug: input.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
        description: input.description || null,
        brand: input.brand || null,
        status: input.status || "draft",
      })
      .returning();

    await AuditService.record(db, {
      organizationId,
      actorId,
      action: "product.created",
      resourceType: "product",
      resourceId: product.id,
      afterState: product,
      reason: "Product created via catalog management",
    });

    return product;
  }

  static async updateProduct(
    organizationId: string,
    productId: string,
    input: Partial<CreateProductInput>,
    actorId: string
  ) {
    const [existing] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Product", productId);
    }

    const updates: Partial<typeof products.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) updates.name = input.name;
    if (input.slug !== undefined) updates.slug = input.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    if (input.description !== undefined) updates.description = input.description;
    if (input.brand !== undefined) updates.brand = input.brand;
    if (input.status !== undefined) updates.status = input.status;

    const [updated] = await db
      .update(products)
      .set(updates)
      .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)))
      .returning();

    await AuditService.record(db, {
      organizationId,
      actorId,
      action: "product.updated",
      resourceType: "product",
      resourceId: productId,
      beforeState: existing,
      afterState: updated,
      reason: "Product details updated",
    });

    return updated;
  }

  static async archiveProduct(organizationId: string, productId: string, actorId: string) {
    const [existing] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Product", productId);
    }

    const [archived] = await db
      .update(products)
      .set({
        status: "archived",
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)))
      .returning();

    await AuditService.record(db, {
      organizationId,
      actorId,
      action: "product.archived",
      resourceType: "product",
      resourceId: productId,
      beforeState: existing,
      afterState: archived,
      reason: "Product archived (retaining historical data)",
    });

    return archived;
  }

  static async createVariant(
    organizationId: string,
    productId: string,
    input: CreateVariantInput,
    actorId: string
  ) {
    // 1. Verify product exists in organization
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)))
      .limit(1);

    if (!product) {
      throw new NotFoundError("Product", productId);
    }

    // 2. Check SKU uniqueness within organization
    const [existingSku] = await db
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(and(eq(productVariants.organizationId, organizationId), eq(productVariants.sku, input.sku)))
      .limit(1);

    if (existingSku) {
      throw new ConflictError(`SKU '${input.sku}' already exists within this organization`);
    }

    const variantId = `var_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return await db.transaction(async (tx) => {
      const [variant] = await tx
        .insert(productVariants)
        .values({
          id: variantId,
          organizationId,
          productId,
          sku: input.sku.trim(),
          barcode: input.barcode?.trim() || null,
          variantAttributes: input.variantAttributes || {},
          unitOfMeasure: input.unitOfMeasure || "unit",
          weight: input.weight || null,
          status: input.status || "active",
        })
        .returning();

      if (input.price) {
        if (!input.price.storeId || !input.price.currency || input.price.amountMinor < 0) {
          throw new ValidationError("Invalid pricing: storeId, currency and non-negative amountMinor required");
        }

        const priceId = `prc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await tx.insert(productPrices).values({
          id: priceId,
          organizationId,
          storeId: input.price.storeId,
          variantId,
          currency: input.price.currency.toUpperCase(),
          amountMinor: Math.round(input.price.amountMinor),
          effectiveFrom: new Date(),
        });
      }

      await AuditService.record(tx, {
        organizationId,
        actorId,
        action: "variant.created",
        resourceType: "product_variant",
        resourceId: variant.id,
        afterState: variant,
        reason: `Created variant SKU: ${input.sku}`,
      });

      return variant;
    });
  }

  static async updateVariant(
    organizationId: string,
    variantId: string,
    input: Partial<CreateVariantInput>,
    actorId: string
  ) {
    const [existing] = await db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.id, variantId), eq(productVariants.organizationId, organizationId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("ProductVariant", variantId);
    }

    if (input.sku && input.sku !== existing.sku) {
      const [duplicate] = await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(and(eq(productVariants.organizationId, organizationId), eq(productVariants.sku, input.sku)))
        .limit(1);

      if (duplicate) {
        throw new ConflictError(`SKU '${input.sku}' already exists within this organization`);
      }
    }

    const updates: Partial<typeof productVariants.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.sku !== undefined) updates.sku = input.sku.trim();
    if (input.barcode !== undefined) updates.barcode = input.barcode ? input.barcode.trim() : null;
    if (input.variantAttributes !== undefined) updates.variantAttributes = input.variantAttributes;
    if (input.unitOfMeasure !== undefined) updates.unitOfMeasure = input.unitOfMeasure;
    if (input.weight !== undefined) updates.weight = input.weight;
    if (input.status !== undefined) updates.status = input.status;

    const [updated] = await db
      .update(productVariants)
      .set(updates)
      .where(and(eq(productVariants.id, variantId), eq(productVariants.organizationId, organizationId)))
      .returning();

    await AuditService.record(db, {
      organizationId,
      actorId,
      action: "variant.updated",
      resourceType: "product_variant",
      resourceId: variantId,
      beforeState: existing,
      afterState: updated,
      reason: "Variant details updated",
    });

    return updated;
  }

  static async setProductPrice(
    organizationId: string,
    storeId: string,
    variantId: string,
    currency: string,
    amountMinor: number,
    actorId: string
  ) {
    if (amountMinor < 0) {
      throw new ValidationError("Monetary amount cannot be negative");
    }

    // Verify variant exists
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.id, variantId), eq(productVariants.organizationId, organizationId)))
      .limit(1);

    if (!variant) {
      throw new NotFoundError("ProductVariant", variantId);
    }

    const id = `prc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const [price] = await db
      .insert(productPrices)
      .values({
        id,
        organizationId,
        storeId,
        variantId,
        currency: currency.toUpperCase(),
        amountMinor: Math.round(amountMinor),
        effectiveFrom: new Date(),
      })
      .returning();

    await AuditService.record(db, {
      organizationId,
      storeId,
      actorId,
      action: "price.set",
      resourceType: "product_price",
      resourceId: price.id,
      afterState: price,
      reason: `Updated price for variant ${variant.sku} to ${amountMinor} (${currency})`,
    });

    return price;
  }

  static async listProducts(
    organizationId: string,
    filters?: {
      status?: string;
      search?: string;
      brand?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const conditions = [eq(products.organizationId, organizationId)];

    if (filters?.status) {
      conditions.push(eq(products.status, filters.status));
    }
    if (filters?.brand) {
      conditions.push(eq(products.brand, filters.brand));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(products.name, `%${filters.search}%`),
          ilike(products.slug, `%${filters.search}%`),
          ilike(products.brand, `%${filters.search}%`)
        )!
      );
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const items = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .offset(offset);

    // Fetch variants for each product
    const productIds = items.map((p) => p.id);
    let allVariants: (typeof productVariants.$inferSelect)[] = [];
    if (productIds.length > 0) {
      allVariants = await db
        .select()
        .from(productVariants)
        .where(
          and(
            eq(productVariants.organizationId, organizationId),
            sql`${productVariants.productId} IN ${productIds}`
          )
        );
    }

    // Attach variants to products
    const enriched = items.map((prod) => ({
      ...prod,
      variants: allVariants.filter((v) => v.productId === prod.id),
    }));

    return enriched;
  }

  static async getProduct(organizationId: string, productId: string) {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.organizationId, organizationId)))
      .limit(1);

    if (!product) {
      throw new NotFoundError("Product", productId);
    }

    const variants = await db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.productId, productId), eq(productVariants.organizationId, organizationId)));

    const variantIds = variants.map((v) => v.id);
    let prices: (typeof productPrices.$inferSelect)[] = [];
    let balances: (typeof inventoryBalances.$inferSelect)[] = [];

    if (variantIds.length > 0) {
      prices = await db
        .select()
        .from(productPrices)
        .where(
          and(
            eq(productPrices.organizationId, organizationId),
            sql`${productPrices.variantId} IN ${variantIds}`
          )
        )
        .orderBy(desc(productPrices.effectiveFrom));

      balances = await db
        .select()
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.organizationId, organizationId),
            sql`${inventoryBalances.variantId} IN ${variantIds}`
          )
        );
    }

    const enrichedVariants = variants.map((v) => ({
      ...v,
      prices: prices.filter((p) => p.variantId === v.id),
      inventory: balances
        .filter((b) => b.variantId === v.id)
        .map((b) => ({
          locationId: b.locationId,
          onHand: b.onHand,
          reserved: b.reserved,
          available: b.onHand - b.reserved,
        })),
    }));

    return {
      ...product,
      variants: enrichedVariants,
    };
  }
}

