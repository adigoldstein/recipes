import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { setImportTimeouts } from './client';
import { importsListProvidersOptions } from './generated/@tanstack/react-query.gen';

/**
 * Loads the active import engines (`GET /api/imports/providers`). When they are
 * loaded, the client sets its import time limit to the engine's timeout plus 5
 * seconds (AD-43).
 */
export function useImportEngines() {
  const query = useQuery(importsListProvidersOptions());
  const { data } = query;
  useEffect(() => {
    if (data) setImportTimeouts(data.map((engine) => engine.timeout_s));
  }, [data]);
  return query;
}
