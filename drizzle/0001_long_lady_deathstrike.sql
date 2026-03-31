CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"issue_id" uuid,
	"test_history_id" uuid,
	"original_file_name" varchar(255) NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_path" text NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachments_single_parent_check" CHECK (NOT ("attachments"."issue_id" IS NOT NULL AND "attachments"."test_history_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_issue_id_station_issue_records_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."station_issue_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_test_history_id_station_test_history_id_fk" FOREIGN KEY ("test_history_id") REFERENCES "public"."station_test_history"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_station_id_idx" ON "attachments" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "attachments_issue_id_idx" ON "attachments" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "attachments_test_history_id_idx" ON "attachments" USING btree ("test_history_id");--> statement-breakpoint
CREATE INDEX "attachments_uploaded_by_idx" ON "attachments" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "attachments_created_at_idx" ON "attachments" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_storage_path_unique" ON "attachments" USING btree ("storage_path");