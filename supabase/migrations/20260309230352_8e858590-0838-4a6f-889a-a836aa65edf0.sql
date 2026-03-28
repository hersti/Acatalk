
-- Update existing universities with proper metadata
UPDATE public.universities SET city = 'İzmir', type = 'vakıf' WHERE name = 'Kavram Üniversitesi';
UPDATE public.universities SET city = 'İzmir', type = 'devlet' WHERE name = 'Ege Üniversitesi';
UPDATE public.universities SET city = 'Mersin', type = 'devlet' WHERE name = 'Mersin Üniversitesi';
