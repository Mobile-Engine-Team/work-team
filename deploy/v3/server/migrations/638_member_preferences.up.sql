CREATE TABLE mobilework_preference (
    user_id uuid PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    theme text NOT NULL DEFAULT 'system' CHECK(theme IN('system','light','dark')),
    chat_size integer NOT NULL DEFAULT 15 CHECK(chat_size BETWEEN 12 AND 24),
    instructions text NOT NULL DEFAULT '',
    memory text NOT NULL DEFAULT '',
    version integer NOT NULL DEFAULT 1
);
