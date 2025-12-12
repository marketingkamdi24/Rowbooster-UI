CREATE TABLE IF NOT EXISTS "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"openai_api_key" text,
	"gemini_api_key" text,
	"serp_api_key" text,
	"valueserp_api_key" text,
	"valueserp_location" text DEFAULT 'us',
	"default_ai_model" text DEFAULT 'openai',
	"default_search_method" text DEFAULT 'google',
	"use_valueserp" boolean DEFAULT true,
	"use_ai" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "excluded_domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"reason" text,
	"is_active" boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS "manufacturer_domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"website_url" text NOT NULL,
	"is_active" boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS "product_properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"expected_format" text,
	"order_index" integer DEFAULT 0,
	"is_required" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS "search_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_number" text NOT NULL,
	"product_name" text NOT NULL,
	"search_method" text NOT NULL,
	"properties" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "token_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_provider" text NOT NULL,
	"model_name" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"total_tokens" integer NOT NULL,
	"api_call_type" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true,
	"failed_login_attempts" integer DEFAULT 0,
	"last_failed_login" timestamp,
	"locked_until" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_user_id_users_id_fk";
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;