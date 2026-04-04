ALTER TABLE "station_models" ADD COLUMN "image_storage_path" text;--> statement-breakpoint
ALTER TABLE "station_models" ADD COLUMN "image_mime_type" varchar(255);--> statement-breakpoint
ALTER TABLE "station_models" ADD COLUMN "image_original_file_name" varchar(255);--> statement-breakpoint
ALTER TABLE "station_models" ADD COLUMN "image_size_bytes" integer;--> statement-breakpoint
ALTER TABLE "station_models" ADD COLUMN "image_updated_at" timestamp with time zone;