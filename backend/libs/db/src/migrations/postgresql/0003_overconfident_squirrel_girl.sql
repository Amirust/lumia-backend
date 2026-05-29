CREATE TABLE "image_tag_index" (
	"image_id" text PRIMARY KEY NOT NULL,
	"tag_ids" integer[] NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tags_to_images" ADD CONSTRAINT "tags_to_images_image_id_tag_id_pk" PRIMARY KEY("image_id","tag_id");--> statement-breakpoint
ALTER TABLE "image_tag_index" ADD CONSTRAINT "image_tag_index_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_tag_index_tag_ids_idx" ON "image_tag_index" USING gin ("tag_ids");