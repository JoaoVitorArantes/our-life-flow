CREATE TABLE public.app_user_connections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 connector_id text NOT NULL CHECK (connector_id = 'google_calendar'),
 workspace_id uuid NOT NULL,
 connection_key_ciphertext text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (user_id, connector_id)
);
GRANT ALL ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.app_user_oauth_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 workspace_id uuid NOT NULL,
 connector_id text NOT NULL CHECK (connector_id = 'google_calendar'),
 nonce_hash text NOT NULL,
 return_url text NOT NULL,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_user_oauth_attempts TO service_role;
ALTER TABLE public.app_user_oauth_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX app_user_oauth_attempts_owner ON public.app_user_oauth_attempts(user_id, connector_id);
COMMENT ON TABLE public.app_user_connections IS 'Server-only encrypted per-person connector handles. No browser grants or policies. Workspace authorization is rechecked before every use.';
COMMENT ON TABLE public.app_user_oauth_attempts IS 'Server-only short-lived OAuth completion binding. Contains no authorization codes or connection keys.';