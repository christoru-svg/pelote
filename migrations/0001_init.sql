-- Pelote : schéma initial. Chaque ligne appartient à un utilisateur (email Access).

CREATE TABLE users (
  email       TEXT PRIMARY KEY,
  cat_name    TEXT NOT NULL DEFAULT 'Pilou',
  cat_coat    TEXT NOT NULL DEFAULT 'tuxedo',
  checkin     TEXT NOT NULL DEFAULT '09:00',
  recre       TEXT NOT NULL DEFAULT '17:30',
  soir        TEXT NOT NULL DEFAULT '18:00',
  onboarded   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tasks (
  id          TEXT PRIMARY KEY,
  user        TEXT NOT NULL,
  title       TEXT NOT NULL,
  due_date    TEXT,              -- YYYY-MM-DD
  due_time    TEXT,              -- HH:MM
  minutes     INTEGER,           -- durée estimée
  tag         TEXT,
  important   INTEGER NOT NULL DEFAULT 0,
  done        INTEGER NOT NULL DEFAULT 0,
  done_at     TEXT,
  where_note  TEXT,              -- « où j'en suis » (Nœud)
  next_note   TEXT,              -- « prochaine action » (Nœud)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX tasks_user ON tasks(user, done);

CREATE TABLE fil (
  user        TEXT PRIMARY KEY,
  task_id     TEXT,
  title       TEXT NOT NULL,
  started_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE knots (
  id          TEXT PRIMARY KEY,
  user        TEXT NOT NULL,
  from_title  TEXT NOT NULL,
  to_title    TEXT NOT NULL,
  where_note  TEXT,
  next_note   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX knots_user ON knots(user, created_at);

CREATE TABLE thoughts (
  id          TEXT PRIMARY KEY,
  user        TEXT NOT NULL,
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX thoughts_user ON thoughts(user, created_at);

CREATE TABLE reminders (
  id          TEXT PRIMARY KEY,
  user        TEXT NOT NULL,
  thought_id  TEXT,
  label       TEXT NOT NULL,
  due_date    TEXT,
  due_time    TEXT,
  status      TEXT NOT NULL DEFAULT 'soir',  -- soir | fait | demain
  remind_on   TEXT NOT NULL,                  -- jour du bilan (YYYY-MM-DD)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX reminders_user ON reminders(user, remind_on);

CREATE TABLE panier (
  id          TEXT PRIMARY KEY,
  user        TEXT NOT NULL,
  kind        TEXT NOT NULL,     -- texte | lien | image
  title       TEXT NOT NULL,
  body        TEXT,
  url         TEXT,
  image_key   TEXT,
  tag         TEXT,
  why         TEXT,
  context     TEXT,              -- le fil au moment de la capture
  opened_at   TEXT,
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX panier_user ON panier(user, archived, created_at);

CREATE TABLE states (
  id          TEXT PRIMARY KEY,
  user        TEXT NOT NULL,
  mood        INTEGER,           -- 1 Grognon … 5 Ronron
  energy      INTEGER,           -- 1 Sieste, 2 Ronron, 3 Zoomies
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX states_user ON states(user, created_at);
