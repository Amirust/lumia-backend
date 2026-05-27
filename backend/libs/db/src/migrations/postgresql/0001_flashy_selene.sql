CREATE TYPE "public"."anime_status" AS ENUM('anons', 'ongoing', 'released');--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "shikimori_id" integer;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "status" "anime_status";--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "episodes_count" integer;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "episodes_aired" integer;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "aired_on" date;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "released_on" date;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "rating" text;--> statement-breakpoint
CREATE INDEX "seasons_shikimori_id_idx" ON "seasons" USING btree ("shikimori_id");--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_shikimori_id_unique" UNIQUE("shikimori_id");
