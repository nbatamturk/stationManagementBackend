ALTER TABLE "stations" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
UPDATE "stations" SET "status" = 'inactive' WHERE "status" = 'archived';--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "status" SET DEFAULT 'active'::text;--> statement-breakpoint
DROP TYPE "public"."station_status";--> statement-breakpoint
CREATE TYPE "public"."station_status" AS ENUM('active', 'maintenance', 'inactive', 'faulty');--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."station_status";--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "status" SET DATA TYPE "public"."station_status" USING "status"::"public"."station_status";--> statement-breakpoint
ALTER TABLE "station_test_history" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "station_test_history" SET "updated_at" = "created_at";--> statement-breakpoint
