-- Recording the selected ID also distinguishes retries after a rename or archive.
ALTER TABLE collaboration_message ADD COLUMN selected_agent_id uuid;

-- Use literal display names. A substring inside an email or a longer handle
-- cannot select a runtime. Punctuation can follow a completed mention.
CREATE FUNCTION room_names_agent(body text, name text) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT EXISTS (
    SELECT 1 FROM (SELECT string_to_array(body, '@' || name) AS parts) a,
      LATERAL generate_subscripts(a.parts,1) n
    WHERE n < array_length(a.parts,1)
      AND (a.parts[n] = '' OR a.parts[n] ~ '[[:space:]]$')
      AND (a.parts[n+1] = '' OR a.parts[n+1] ~ '^[[:space:][:punct:]]')
  )
$$;
