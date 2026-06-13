ALTER TABLE "users" ALTER COLUMN "rfid_uid" SET DATA TYPE varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "users_rfid_uid_idx" ON "users" USING btree ("rfid_uid");