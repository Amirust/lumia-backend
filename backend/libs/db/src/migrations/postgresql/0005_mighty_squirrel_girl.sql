ALTER TABLE "characters" DROP CONSTRAINT "characters_tag_id_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "characters" DROP CONSTRAINT "characters_image_id_images_id_fk";
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE set null ON UPDATE no action;