CREATE TABLE "mobile_app_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_key" varchar(40) DEFAULT 'default' NOT NULL,
	"ios_minimum_supported_version" varchar(32),
	"android_minimum_supported_version" varchar(32),
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mobile_app_config" ADD CONSTRAINT "mobile_app_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_app_config_key_unique" ON "mobile_app_config" USING btree ("config_key");