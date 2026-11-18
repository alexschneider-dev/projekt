-- Vorhandene Rollenwerte umbenennen, ohne Konten oder Berechtigungen zu verändern.
ALTER TYPE "InternalRole" RENAME VALUE 'user' TO 'USER';
ALTER TYPE "InternalRole" RENAME VALUE 'admin' TO 'ADMIN';
ALTER TYPE "InternalRole" RENAME VALUE 'super_admin' TO 'SUPER_ADMIN';
