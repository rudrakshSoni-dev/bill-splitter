-- homes -> members -> bills -> shares
-- money is always INTEGER cents

CREATE TABLE homes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT homes_name_not_blank CHECK (length(trim(name)) > 0)
);

-- position = order the member joined the home (1, 2, 3 ...). the split hands out
-- leftover cents in this order so it has to be stable and unique per home
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  CONSTRAINT members_home_fk FOREIGN KEY (home_id) REFERENCES homes (id) ON DELETE CASCADE,
  CONSTRAINT members_position_per_home UNIQUE (home_id, position),
  CONSTRAINT members_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL,
  title TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT bills_home_fk FOREIGN KEY (home_id) REFERENCES homes (id) ON DELETE CASCADE,
  CONSTRAINT bills_total_positive_int CHECK (typeof(total_cents) = 'integer' AND total_cents > 0),
  CONSTRAINT bills_title_not_blank CHECK (length(trim(title)) > 0)
);

CREATE INDEX bills_by_home ON bills (home_id, created_at);

-- a share can be 0 cents (e.g. 2 cents split between 3 people)
-- paid_at and pay_key are set together in one UPDATE, never one without the other
CREATE TABLE shares (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_at TEXT,
  pay_key TEXT,
  CONSTRAINT shares_bill_fk FOREIGN KEY (bill_id) REFERENCES bills (id) ON DELETE CASCADE,
  CONSTRAINT shares_member_fk FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE,
  CONSTRAINT shares_one_per_member UNIQUE (bill_id, member_id),
  CONSTRAINT shares_amount_non_negative CHECK (typeof(amount_cents) = 'integer' AND amount_cents >= 0),
  CONSTRAINT shares_paid_has_key CHECK ((paid_at IS NULL) = (pay_key IS NULL))
);

CREATE INDEX shares_by_member ON shares (member_id);
