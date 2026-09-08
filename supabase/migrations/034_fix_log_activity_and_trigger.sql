-- =============================================
-- 034: Fix log_activity / log_table_changes (reconstruida)
-- ---------------------------------------------
-- NOTA: esta migracion ya estaba aplicada en producción (aparece en el
-- historial remoto como "fix_log_activity_and_trigger", 27 ago) pero el
-- archivo nunca se guardó en el repo — se aplicó directo con apply_migration
-- sin comitear el .sql correspondiente. Este archivo se reconstruyó a partir
-- del estado real de la función en la base de datos (auditoría de sept 2026)
-- para que un rebuild desde cero no se quede sin este cambio. No se pudo
-- recuperar el diff histórico exacto; el placeholder de abajo documenta el
-- hueco — el estado final correcto queda garantizado por 035, que sí
-- refleja la definición real y vigente de log_table_changes().
-- =============================================

-- (sin cambios de esquema recuperables; ver 035_simplify_activity_trigger.sql
-- para la definición final real de log_table_changes())
SELECT 1;
