import { Level } from 'level';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

export async function openKV(name, ephemeral = false) {
  let location = name;

  if (ephemeral) {
    const id = crypto.randomUUID();
    location = `.tmp/${name}_${id}`;
  }

  return new Level(location, { valueEncoding: 'view' });
}

export async function destroyKV(db) {
  const loc = db.location;
  await db.close();
  if (loc) await fs.rm(loc, { recursive: true, force: true });
}
