ALTER TABLE "task_queue" ALTER COLUMN "keep_until" SET DEFAULT (now() + interval '14 days');--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "permissions" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "username" text;