-- Add expiration date to requests table
-- This allows setting configurable expiration dates for requests

-- Add expires_at column to requests table
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN public.requests.expires_at IS 'Optional expiration date for the request. NULL means no expiration.';

-- Create a function to get request creator name for display
CREATE OR REPLACE FUNCTION public.get_request_creator_name(_request_id UUID)
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT raw_user_meta_data->>'full_name' 
     FROM auth.users 
     WHERE id = (SELECT created_by FROM public.requests WHERE id = _request_id)),
    (SELECT email 
     FROM auth.users 
     WHERE id = (SELECT created_by FROM public.requests WHERE id = _request_id)),
    'Unknown'
  );
$$;

-- Add index on expires_at for performance
CREATE INDEX IF NOT EXISTS idx_requests_expires_at ON public.requests(expires_at);
