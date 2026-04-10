CREATE TYPE "public"."expense_category" AS ENUM('food', 'transport', 'accommodation', 'activity', 'other');--> statement-breakpoint
CREATE TABLE "trip_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"paid_by" text NOT NULL,
	"title" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"category" "expense_category" DEFAULT 'other' NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_expenses_trip_id_idx" ON "trip_expenses" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_expenses_paid_by_idx" ON "trip_expenses" USING btree ("paid_by");