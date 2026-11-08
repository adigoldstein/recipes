import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { setImportTimeouts } from './client';
import { importsListProvidersOptions } from './generated/@tanstack/react-query.gen';

/**
 * The active import engine(s) (`GET /api/imports/providers`). Once they are known the
 * client's own import time limit follows the engine's timeout plus 5 s (AD-43).
 */
export function useImportEngines() {
  const query = useQuery(importsListProvidersOptions());
  const { data } = query;
  useEffect(() => {
    if (data) setImportTimeouts(data.map((engine) => engine.timeout_s));
  }, [data]);
  return query;
}
