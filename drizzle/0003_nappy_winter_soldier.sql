ALTER TABLE "trips" ADD COLUMN "budget_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "budget_currency" char(3) DEFAULT 'HKD' NOT NULL;