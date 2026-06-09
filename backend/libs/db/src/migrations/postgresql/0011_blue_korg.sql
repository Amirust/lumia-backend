CREATE INDEX "tags_name_trgm_idx" ON "tags" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
ALTER TABLE "images" DROP COLUMN "error_message";