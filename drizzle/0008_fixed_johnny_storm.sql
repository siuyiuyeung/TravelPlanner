CREATE TABLE "trip_blocked" (
	"trip_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_blocked_trip_id_user_id_uniq" UNIQUE("trip_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "trip_editors" (
	"trip_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_editors_trip_id_user_id_uniq" UNIQUE("trip_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "share_token" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_blocked" ADD CONSTRAINT "trip_blocked_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_blocked" ADD CONSTRAINT "trip_blocked_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_editors" ADD CONSTRAINT "trip_editors_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_editors" ADD CONSTRAINT "trip_editors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_blocked_trip_id_idx" ON "trip_blocked" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_blocked_user_id_idx" ON "trip_blocked" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trip_editors_trip_id_idx" ON "trip_editors" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_editors_user_id_idx" ON "trip_editors" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_share_token_unique" UNIQUE("share_token");