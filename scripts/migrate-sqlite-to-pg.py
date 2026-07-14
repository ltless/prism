#!/usr/bin/env python3
"""
Phase 4: Migrate data from SQLite (global + per-user tenant DBs) to PostgreSQL.

Usage:
  python3 scripts/migrate-sqlite-to-pg.py [--dry-run]

Reads:
  - prism.db (global: users, app_config, app_settings)
  - storage/users/<user-id>/prism.db (tenant: folders, media, media_tags, error_logs)

Writes to PostgreSQL via psycopg2.
"""

import sqlite3
import os
import sys
import json
import re

PG_CONN = os.environ.get("DATABASE_URL", "postgresql://prism:prism_dev_2024@localhost:5432/prism")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DRY_RUN = "--dry-run" in sys.argv

def log(msg):
    print(f"  {msg}")

def migrate():
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)

    pg = psycopg2.connect(PG_CONN)
    pg.autocommit = False
    cur = pg.cursor()

    # ─── 1. Users from global DB ──────────
    global_db_path = os.path.join(ROOT, "prism.db")
    if not os.path.exists(global_db_path):
        print("No prism.db found — skipping migration")
        return

    sconn = sqlite3.connect(global_db_path)
    sconn.row_factory = sqlite3.Row

    users = sconn.execute("SELECT * FROM users").fetchall()
    print(f"\n[1/4] Migrating {len(users)} users...")
    for u in users:
        if DRY_RUN:
            log(f"  DRY-RUN: user {u['username']} ({u['id']})")
            continue
        cur.execute("""
            INSERT INTO users (id, username, password_hash, role, image, cover_image,
              has_completed_setup, vault_pin, storage_limit, preferences)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (
            u["id"], u["username"], u["password_hash"], u["role"],
            u["image"], u["cover_image"],
            bool(u["has_completed_setup"]),
            u["vault_pin"], u["storage_limit"], u["preferences"],
        ))
    if not DRY_RUN:
        pg.commit()
    log(f"  Done: {len(users)} users")

    # ─── 2. app_config from global DB ─────────────
    config_rows = sconn.execute("SELECT * FROM app_config").fetchall()
    print(f"\n[2/4] Migrating {len(config_rows)} app_config rows...")
    for c in config_rows:
        if DRY_RUN:
            log(f"  DRY-RUN: app_config id={c['id']}")
            continue
        cur.execute("""
            INSERT INTO app_config (id, ai, updated_at, updated_by)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (
            c["id"], c["ai"], c["updated_at"], c["updated_by"],
        ))
    if not DRY_RUN:
        pg.commit()
    log(f"  Done: {len(config_rows)} config rows")

    # ─── 3. app_settings from global DB ───────────
    settings_rows = sconn.execute("SELECT * FROM app_settings").fetchall()
    print(f"\n[3/4] Migrating {len(settings_rows)} app_settings rows...")
    for s in settings_rows:
        if DRY_RUN:
            log(f"  DRY-RUN: app_settings key={s['key']}")
            continue
        cur.execute("""
            INSERT INTO app_settings (key, value)
            VALUES (%s, %s)
            ON CONFLICT (key) DO NOTHING
        """, (s["key"], s["value"]))
    if not DRY_RUN:
        pg.commit()
    log(f"  Done: {len(settings_rows)} settings rows")

    sconn.close()

    # ─── 4. Tenant data (folders, media, media_tags) from per-user DBs ────
    users_dir = os.path.join(ROOT, "storage", "users")
    if not os.path.isdir(users_dir):
        print("\n[4/4] No storage/users/ directory — skipping tenant data")
        cur.close()
        pg.close()
        return

    tenant_user_ids = [d for d in os.listdir(users_dir)
                       if os.path.isdir(os.path.join(users_dir, d)) and
                       os.path.exists(os.path.join(users_dir, d, "prism.db"))]

    print(f"\n[4/4] Migrating tenant data for {len(tenant_user_ids)} users...")

    for user_id in tenant_user_ids:
        tenant_db_path = os.path.join(users_dir, user_id, "prism.db")
        tconn = sqlite3.connect(tenant_db_path)
        tconn.row_factory = sqlite3.Row

        # Folders
        folders = tconn.execute("SELECT * FROM folders").fetchall()
        if folders:
            log(f"  [{user_id[:8]}] {len(folders)} folders...")
            for f in folders:
                if DRY_RUN:
                    continue
                cur.execute("""
                    INSERT INTO folders (id, user_id, name, color, parent_id,
                      folder_type, filter_query, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                """, (
                    f["id"], user_id, f["name"], f["color"], f["parent_id"],
                    f["folder_type"], f["filter_query"],
                    f["created_at"], f["updated_at"],
                ))
            if not DRY_RUN:
                pg.commit()

        # Media
        media = tconn.execute("SELECT * FROM media").fetchall()
        if media:
            log(f"  [{user_id[:8]}] {len(media)} media items...")
            for m in media:
                if DRY_RUN:
                    continue
                # Sanitize metadata: remove control characters that PG JSONB rejects
                metadata = m["metadata"]
                if metadata:
                    metadata = re.sub(r'[\x00-\x1f]', '', metadata)
                    metadata = metadata.replace('\\u0000', '')
                cur.execute("""
                    INSERT INTO media (id, user_id, title, file_path, mime_type, size,
                      width, height, hash, captured_at, metadata, folder_id,
                      is_favorite, is_trash, is_vault, updated_at, created_at,
                      duration, transcode_status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                """, (
                    m["id"], user_id, m["title"], m["file_path"], m["mime_type"],
                    m["size"], m["width"], m["height"], m["hash"],
                    m["captured_at"], metadata, m["folder_id"],
                    bool(m["is_favorite"]), bool(m["is_trash"]), bool(m["is_vault"]),
                    m["updated_at"], m["created_at"],
                    m["duration"], m["transcode_status"],
                ))
            if not DRY_RUN:
                pg.commit()

        # Media tags
        tags = tconn.execute("SELECT * FROM media_tags").fetchall()
        if tags:
            log(f"  [{user_id[:8]}] {len(tags)} media_tags...")
            for t in tags:
                if DRY_RUN:
                    continue
                cur.execute("""
                    INSERT INTO media_tags (media_id, user_id, tag, score, category)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    t["media_id"], user_id, t["tag"], t["score"], t["category"],
                ))
            if not DRY_RUN:
                pg.commit()

        tconn.close()

    cur.close()
    pg.close()
    print(f"\n{'DRY-RUN' if DRY_RUN else 'Migration'} complete!")

if __name__ == "__main__":
    migrate()
