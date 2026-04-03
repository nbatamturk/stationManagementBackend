ALTER TYPE "public"."socket_type" RENAME TO "connector_type";--> statement-breakpoint
CREATE TABLE "station_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"connector_no" integer NOT NULL,
	"connector_type" "connector_type" NOT NULL,
	"current_type" "current_type" NOT NULL,
	"power_kw" numeric(10, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_model_connector_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"connector_no" integer NOT NULL,
	"connector_type" "connector_type" NOT NULL,
	"current_type" "current_type" NOT NULL,
	"power_kw" numeric(10, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "station_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"image_url" text,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "socket_type" SET DATA TYPE varchar(250) USING "socket_type"::text;--> statement-breakpoint
ALTER TABLE "station_issue_records" ADD COLUMN "connector_id" uuid;--> statement-breakpoint
ALTER TABLE "station_test_history" ADD COLUMN "connector_id" uuid;--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "model_id" uuid;--> statement-breakpoint
ALTER TABLE "stations" ADD COLUMN "model_template_version" integer;--> statement-breakpoint
INSERT INTO "station_brands" ("name")
SELECT DISTINCT btrim("brand")
FROM "stations"
WHERE btrim("brand") <> '';--> statement-breakpoint
INSERT INTO "station_models" ("brand_id", "name")
SELECT DISTINCT sb."id", btrim(s."model")
FROM "stations" s
JOIN "station_brands" sb ON sb."name" = btrim(s."brand")
WHERE btrim(s."model") <> '';--> statement-breakpoint
UPDATE "stations" s
SET "brand_id" = sb."id"
FROM "station_brands" sb
WHERE sb."name" = btrim(s."brand");--> statement-breakpoint
UPDATE "stations" s
SET "model_id" = sm."id"
FROM "station_models" sm
WHERE sm."brand_id" = s."brand_id"
  AND sm."name" = btrim(s."model");--> statement-breakpoint
INSERT INTO "station_connectors" (
	"station_id",
	"connector_no",
	"connector_type",
	"current_type",
	"power_kw",
	"is_active",
	"sort_order",
	"is_deleted",
	"deleted_at"
)
SELECT
	s."id",
	1,
	CASE
		WHEN s."socket_type" IN ('Type2', 'CCS2', 'CHAdeMO', 'GBT', 'NACS', 'Other')
			THEN s."socket_type"::"connector_type"
		ELSE 'Type2'::"connector_type"
	END,
	CASE
		WHEN s."current_type"::text IN ('AC', 'DC')
			THEN s."current_type"
		ELSE 'AC'::"current_type"
	END,
	CASE
		WHEN s."power_kw" IS NOT NULL AND s."power_kw" > 0
			THEN s."power_kw"
		ELSE 22
	END,
	true,
	1,
	false,
	null
FROM "stations" s;--> statement-breakpoint
WITH "live_connectors" AS (
	SELECT
		c."station_id",
		c."connector_no",
		c."sort_order",
		c."connector_type"::text AS "connector_type",
		c."current_type",
		c."power_kw"
	FROM "station_connectors" c
	WHERE c."is_deleted" = false
),
"ordered_types" AS (
	SELECT DISTINCT ON (lc."station_id", lc."connector_type")
		lc."station_id",
		lc."connector_type",
		lc."sort_order",
		lc."connector_no"
	FROM "live_connectors" lc
	ORDER BY lc."station_id", lc."connector_type", lc."sort_order", lc."connector_no"
),
"aggregates" AS (
	SELECT
		lc."station_id",
		MAX(lc."power_kw") AS "max_power_kw",
		BOOL_OR(lc."current_type" = 'AC') AS "has_ac",
		BOOL_OR(lc."current_type" = 'DC') AS "has_dc"
	FROM "live_connectors" lc
	GROUP BY lc."station_id"
),
"type_agg" AS (
	SELECT
		ot."station_id",
		STRING_AGG(ot."connector_type", ', ' ORDER BY ot."sort_order", ot."connector_no", ot."connector_type") AS "socket_type"
	FROM "ordered_types" ot
	GROUP BY ot."station_id"
)
UPDATE "stations" s
SET
	"power_kw" = a."max_power_kw",
	"current_type" = CASE WHEN a."has_dc" THEN 'DC'::"current_type" ELSE 'AC'::"current_type" END,
	"socket_type" = ta."socket_type"
FROM "aggregates" a
JOIN "type_agg" ta ON ta."station_id" = a."station_id"
WHERE s."id" = a."station_id";--> statement-breakpoint
ALTER TABLE "station_connectors" ADD CONSTRAINT "station_connectors_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_model_connector_templates" ADD CONSTRAINT "station_model_connector_templates_model_id_station_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."station_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_models" ADD CONSTRAINT "station_models_brand_id_station_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."station_brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_issue_records" ADD CONSTRAINT "station_issue_records_connector_id_station_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."station_connectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_test_history" ADD CONSTRAINT "station_test_history_connector_id_station_connectors_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."station_connectors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_brand_id_station_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."station_brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_model_id_station_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."station_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "brand_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stations" ALTER COLUMN "model_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "station_brands_name_unique" ON "station_brands" USING btree ("name");--> statement-breakpoint
CREATE INDEX "station_brands_is_active_idx" ON "station_brands" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "station_connectors_station_id_idx" ON "station_connectors" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "station_connectors_live_sort_idx" ON "station_connectors" USING btree ("station_id","is_deleted","sort_order","connector_no");--> statement-breakpoint
CREATE UNIQUE INDEX "station_connectors_live_station_connector_no_unique" ON "station_connectors" USING btree ("station_id","connector_no") WHERE "station_connectors"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "station_model_connector_templates_model_version_connector_no_unique" ON "station_model_connector_templates" USING btree ("model_id","version","connector_no");--> statement-breakpoint
CREATE INDEX "station_model_connector_templates_model_version_idx" ON "station_model_connector_templates" USING btree ("model_id","version","sort_order","connector_no");--> statement-breakpoint
CREATE UNIQUE INDEX "station_models_brand_name_unique" ON "station_models" USING btree ("brand_id","name");--> statement-breakpoint
CREATE INDEX "station_models_brand_id_idx" ON "station_models" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "station_models_is_active_idx" ON "station_models" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "station_issue_records_connector_id_idx" ON "station_issue_records" USING btree ("connector_id");--> statement-breakpoint
CREATE INDEX "station_test_history_connector_id_idx" ON "station_test_history" USING btree ("connector_id");--> statement-breakpoint
CREATE INDEX "stations_brand_id_idx" ON "stations" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "stations_model_id_idx" ON "stations" USING btree ("model_id");
