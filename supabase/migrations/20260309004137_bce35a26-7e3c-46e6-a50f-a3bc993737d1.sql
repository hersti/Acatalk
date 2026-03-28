-- Fix default values for profiles table
ALTER TABLE public.profiles 
  ALTER COLUMN university SET DEFAULT 'Ege Üniversitesi',
  ALTER COLUMN department SET DEFAULT 'Elektrik-Elektronik Mühendisliği';

-- Fix default values for courses table  
ALTER TABLE public.courses
  ALTER COLUMN university SET DEFAULT 'Ege Üniversitesi',
  ALTER COLUMN department SET DEFAULT 'Elektrik-Elektronik Mühendisliği';