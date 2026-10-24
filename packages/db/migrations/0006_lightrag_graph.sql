ALTER TABLE "nodes" ADD COLUMN IF NOT EXISTS "box_id" uuid REFERENCES "boxes"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN IF NOT EXISTS "embedding" text;
--> statement-breakpoint
ALTER TABLE "edges" ADD COLUMN IF NOT EXISTS "box_id" uuid REFERENCES "boxes"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nodes_box_id_idx" ON "nodes" ("box_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edges_box_id_idx" ON "edges" ("box_id");
--> statement-breakpoint
UPDATE "nodes" n SET "box_id" = d."box_id"
FROM "documents" d
WHERE n."document_id" = d."id" AND n."box_id" IS NULL AND d."box_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "edges" e SET "box_id" = d."box_id"
FROM "documents" d
WHERE e."document_id" = d."id" AND e."box_id" IS NULL AND d."box_id" IS NOT NULL;
