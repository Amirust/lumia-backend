DROP INDEX "screenshots_image_id_idx";--> statement-breakpoint
ALTER TABLE "screenshots" DROP COLUMN "timestamp_seconds";--> statement-breakpoint
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_image_id_idx" UNIQUE("image_id");