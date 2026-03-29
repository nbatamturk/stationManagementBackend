CREATE TYPE "public"."current_type" AS ENUM('AC', 'DC');--> statement-breakpoint
CREATE TYPE "public"."custom_field_type" AS ENUM('text', 'number', 'boolean', 'select', 'date', 'json');--> statement-breakpoint
CREATE TYPE "public"."issue_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."socket_type" AS ENUM('Type2', 'CCS2', 'CHAdeMO', 'GBT', 'NACS', 'Other');--> statement-breakpoint
CREATE TYPE "public"."station_status" AS ENUM('active', 'maintenance', 'inactive', 'faulty', 'archived');--> statement-breakpoint
CREATE TYPE "public"."station_test_result" AS ENUM('pass', 'fail', 'warning');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'operator', 'viewer');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(80) NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"label" varchar(140) NOT NULL,
	"type" "custom_field_type" NOT NULL,
	"options_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_filterable" boolean DEFAULT false NOT NULL,
	"is_visible_in_list" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_custom_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"field_definition_id" uuid NOT NULL,
	"value_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_issue_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text,
	"severity" "issue_severity" DEFAULT 'medium' NOT NULL,
	"status" "issue_status" DEFAULT 'open' NOT NULL,
	"reported_by" uuid,
	"assigned_to" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_test_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"test_date" timestamp with time zone DEFAULT now() NOT NULL,
	"result" "station_test_result" NOT NULL,
	"notes" text,
	"metrics_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tested_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"code" varchar(80) NOT NULL,
	"qr_code" varchar(150) NOT NULL,
	"brand" varchar(120) NOT NULL,
	"model" varchar(120) NOT NULL,
	"serial_number" varchar(150) NOT NULL,
	"power_kw" numeric(10, 2) NOT NULL,
	"current_type" "current_type" NOT NULL,
	"socket_type" "socket_type" NOT NULL,
	"location" text NOT NULL,
	"status" "station_status" DEFAULT 'active' NOT NULL,
	"last_test_date" timestamp with time zone,
	"notes" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'operator' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_custom_field_values" ADD CONSTRAINT "station_custom_field_values_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_custom_field_values" ADD CONSTRAINT "station_custom_field_values_field_definition_id_custom_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."custom_field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_issue_records" ADD CONSTRAINT "station_issue_records_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_issue_records" ADD CONSTRAINT "station_issue_records_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_issue_records" ADD CONSTRAINT "station_issue_records_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_test_history" ADD CONSTRAINT "station_test_history_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_test_history" ADD CONSTRAINT "station_test_history_tested_by_users_id_fk" FOREIGN KEY ("tested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_definitions_key_unique" ON "custom_field_definitions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "custom_field_definitions_is_active_idx" ON "custom_field_definitions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "custom_field_definitions_sort_order_idx" ON "custom_field_definitions" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "station_custom_field_values_station_field_unique" ON "station_custom_field_values" USING btree ("station_id","field_definition_id");--> statement-breakpoint
CREATE INDEX "station_custom_field_values_station_id_idx" ON "station_custom_field_values" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "station_custom_field_values_field_definition_id_idx" ON "station_custom_field_values" USING btree ("field_definition_id");--> statement-breakpoint
CREATE INDEX "station_issue_records_station_id_idx" ON "station_issue_records" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "station_issue_records_status_idx" ON "station_issue_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "station_issue_records_severity_idx" ON "station_issue_records" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "station_test_history_station_id_idx" ON "station_test_history" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "station_test_history_test_date_idx" ON "station_test_history" USING btree ("test_date");--> statement-breakpoint
CREATE UNIQUE INDEX "stations_code_unique" ON "stations" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "stations_qr_code_unique" ON "stations" USING btree ("qr_code");--> statement-breakpoint
CREATE UNIQUE INDEX "stations_serial_number_unique" ON "stations" USING btree ("serial_number");--> statement-breakpoint
CREATE INDEX "stations_status_idx" ON "stations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stations_brand_idx" ON "stations" USING btree ("brand");--> statement-breakpoint
CREATE INDEX "stations_current_type_idx" ON "stations" USING btree ("current_type");--> statement-breakpoint
CREATE INDEX "stations_is_archived_idx" ON "stations" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "stations_created_at_idx" ON "stations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_is_active_idx" ON "users" USING btree ("is_active");