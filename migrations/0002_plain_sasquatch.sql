CREATE TABLE "face_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_name" varchar(255) NOT NULL,
	"user_id" integer,
	"embedding" text NOT NULL,
	"photo_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_logs" DROP CONSTRAINT "access_logs_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "access_logs" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "face_embeddings" ADD CONSTRAINT "face_embeddings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;