-- ==============================================================================
-- CLEANUP DUPLICATE PRODUCTS & ENFORCE UNIQUENESS
-- ==============================================================================

-- 1. Delete duplicate stock_inputs linked to duplicate products
DELETE FROM public.stock_inputs
WHERE product_id IN (
  SELECT p1.id
  FROM public.products p1
  JOIN public.products p2 
    ON p1.owner_id = p2.owner_id 
   AND p1.name = p2.name 
   AND p1.id < p2.id
);

-- 2. Delete duplicate products, keeping only the newest ID for each unique (owner_id, name)
DELETE FROM public.products p1
USING public.products p2
WHERE p1.owner_id = p2.owner_id
  AND p1.name = p2.name
  AND p1.id < p2.id;

-- 3. Enforce Unique Index so duplicates can never happen again
DROP INDEX IF EXISTS products_owner_name_idx;
CREATE UNIQUE INDEX products_owner_name_idx ON public.products (owner_id, name);

-- 4. Count remaining unique products
SELECT COUNT(*) AS total_unique_products FROM public.products;
