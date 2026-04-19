-- Add one_thing_data JSONB column to user_settings for The ONE Thing framework integration.
-- Stores northStar, goalCascade, dayOneThings, weekOneThings, monthOneThings,
-- monthlyReviews, and monthlyReviewQuestions as a single JSONB blob.
alter table user_settings add column if not exists one_thing_data jsonb;
