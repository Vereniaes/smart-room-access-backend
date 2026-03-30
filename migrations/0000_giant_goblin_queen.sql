CREATE TYPE "public"."user_role" AS ENUM('admin', 'staff', 'student', 'guest');--> statement-breakpoint
CREATE TABLE "access_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"uid" varchar(50) NOT NULL,
	"access_time" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) NOT NULL,
	"room" varchar(100) NOT NULL,
	"message" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"username" varchar(100),
	"password" text,
	"rfid_uid" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'guest' NOT NULL,
	"schedule_start" varchar(10) NOT NULL,
	"schedule_end" varchar(10) NOT NULL,
	"valid_until" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_rfid_uid_unique" UNIQUE("rfid_uid")
);
--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;