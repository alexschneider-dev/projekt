-- ON_ERROR_STOP beendet psql auch innerhalb einer Transaktion mit einem Fehlercode.
SELECT set_config('projekt.setup_error', :'error_message', false)
\gset
DO $$
BEGIN
  RAISE EXCEPTION USING MESSAGE = current_setting('projekt.setup_error');
END
$$;
