ALTER TABLE mobilework_preference ADD COLUMN tone text NOT NULL DEFAULT '简洁' CHECK(tone IN ('简洁','严谨','友好')),
 ADD COLUMN loading_hints boolean NOT NULL DEFAULT true, ADD COLUMN generate_memory boolean NOT NULL DEFAULT false;
