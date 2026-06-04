-- Buscar el ID de la columna "Candidates"
SELECT id, name, color, position
FROM public.kanban_columns
WHERE name ILIKE '%candidate%'
ORDER BY position;
