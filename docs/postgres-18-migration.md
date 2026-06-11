# Postgres 18 Migration Plan

## Summary

Postgres 18.0 changes the default PGDATA path from `/var/lib/postgresql/data` to `/var/lib/postgresql/18/docker`. If you have a persistent volume (e.g. `pgdata` named volume in docker-compose), existing data will NOT be automatically found — Postgres will instead initialize a **new, empty** database cluster.

## How to Migrate

### 1. Dump the old database

```bash
# Start Postgres 16 with existing volume
docker compose up -d db
docker compose exec db pg_dumpall -U postgres > /tmp/pg_dump.sql
docker compose down
```

### 2. Remove the old volume

```bash
docker volume rm vc_pgdata   # or however your volume is named
```

### 3. Start Postgres 18 + restore

```bash
docker compose up -d db
# Wait for Postgres to initialize
sleep 5
# Restore
cat /tmp/pg_dump.sql | docker compose exec -T db psql -U postgres
# Verify
docker compose exec db psql -U postgres -c "\l"
```

## Why this happens

The new PGDATA path is part of the official Postgres 18 Docker image. Named volumes are mounted at `/var/lib/postgresql/data` by default in docker-compose, but Postgres 18 looks for data at `/var/lib/postgresql/18/docker`. Since the volume is empty at that location, it initializes a fresh cluster instead of reusing the existing data.

## Notes

- This is a one-time migration. Future upgrades from 18→19+ will follow the same pattern if PGDATA changes again.
- In production (Kubernetes), the same dump/restore process applies via `pg_dump` + `psql` against the PVC.
- If you see "database files are incompatible with server" or "FATAL: database system files are different", this is the fix.
