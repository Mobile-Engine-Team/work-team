CREATE TABLE issue_reference_url (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id uuid NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
    url text NOT NULL,
    creator_id uuid NOT NULL,
    UNIQUE(issue_id,url)
);
CREATE TABLE issue_member_reminder (
    id uuid PRIMARY KEY,
    issue_id uuid NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
    member_id uuid NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    scheduled_at timestamptz NOT NULL,
    instruction text NOT NULL,
    status text NOT NULL DEFAULT 'scheduled' CHECK(status IN('scheduled','paused','delivered')),
    delivered_at timestamptz
);
CREATE INDEX issue_member_reminder_due ON issue_member_reminder(scheduled_at) WHERE status='scheduled';
