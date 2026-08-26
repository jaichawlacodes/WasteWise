CREATE TABLE "collected_wastes" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer,
	"collector_id" integer,
	"collection_date" timestamp,
	"status" varchar(20) DEFAULT 'collected'
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"message" text,
	"type" varchar(50),
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"location" text,
	"waste_type" varchar(255),
	"amount" varchar(255),
	"image_url" text,
	"verification_result" jsonb,
	"status" varchar(255) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"collector_id" integer
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"points" integer DEFAULT 0,
	"level" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"is_available" boolean DEFAULT true,
	"description" text,
	"name" varchar(255),
	"collection_info" text
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type" varchar(20),
	"amount" integer,
	"description" text,
	"date" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255),
	"name" varchar(255),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "collected_wastes" ADD CONSTRAINT "collected_wastes_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collected_wastes" ADD CONSTRAINT "collected_wastes_collector_id_users_id_fk" FOREIGN KEY ("collector_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_collector_id_users_id_fk" FOREIGN KEY ("collector_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;