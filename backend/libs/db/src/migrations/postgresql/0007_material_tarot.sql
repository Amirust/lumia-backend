DROP INDEX "characters_tag_id_idx";--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_tag_id_idx" UNIQUE("tag_id");