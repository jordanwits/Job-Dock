-- Migrate assignedTo from array of user IDs to array of assignment objects
-- Old format: ["id1", "id2"]
-- New format: [{"userId": "id1", "role": "Team Member", "price": null}, {"userId": "id2", "role": "Team Member", "price": null}]

UPDATE "jobs"
SET "assignedTo" = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', value,
      'role', 'Team Member',
      'price', NULL
    )
  )
  FROM jsonb_array_elements_text("assignedTo"::jsonb) AS value
)
WHERE "assignedTo" IS NOT NULL
  AND jsonb_typeof("assignedTo"::jsonb) = 'array'
  AND (
    -- Check if it's old format (array of strings)
    jsonb_array_length("assignedTo"::jsonb) = 0
    OR jsonb_typeof("assignedTo"::jsonb->0) = 'string'
  );

-- Handle empty arrays - set to null
UPDATE "jobs"
SET "assignedTo" = NULL
WHERE "assignedTo" IS NOT NULL
  AND jsonb_typeof("assignedTo"::jsonb) = 'array'
  AND jsonb_array_length("assignedTo"::jsonb) = 0;
