CREATE TABLE IF NOT EXISTS points_of_interest (
  id  BLOB NOT NULL,
  n   BLOB NOT NULL,
  poi BLOB,
  PRIMARY KEY (id, n)
);
