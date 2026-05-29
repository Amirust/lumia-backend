ALTER TABLE "episodes" DROP CONSTRAINT "episodes_season_id_seasons_id_fk";
--> statement-breakpoint
ALTER TABLE "screenshots" DROP CONSTRAINT "screenshots_episode_id_episodes_id_fk";
--> statement-breakpoint
ALTER TABLE "screenshots" DROP CONSTRAINT "screenshots_image_id_images_id_fk";
--> statement-breakpoint
ALTER TABLE "seasons" DROP CONSTRAINT "seasons_series_id_series_id_fk";
--> statement-breakpoint
ALTER TABLE "series" DROP CONSTRAINT "series_cover_image_id_images_id_fk";
--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_cover_image_id_images_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;