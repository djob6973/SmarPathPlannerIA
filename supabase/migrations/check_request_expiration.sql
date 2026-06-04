-- Verificar si la fecha de vencimiento se guardó en la solicitud
-- Reemplaza <request_id> con el ID de la solicitud que intentaste actualizar
-- El ID del log es: 4495d1ce-57b8-49fe-805a-f46eb2223162

SELECT 
  id, 
  title, 
  expires_at,
  updated_at
FROM public.requests 
WHERE id = '4495d1ce-57b8-49fe-805a-f46eb2223162';
