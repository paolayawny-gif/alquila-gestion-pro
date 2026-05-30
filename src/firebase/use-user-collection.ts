import { APP_ID } from '@/lib/constants';
import { collection, query, QueryConstraint, CollectionReference, Query, orderBy as orderByFn, where as whereFn } from 'firebase/firestore';
import { useFirestore, useMemoFirebase } from './provider';
import { useCollection } from './firestore/use-collection';


/**
 * Hook unificado para acceder a colecciones bajo `users/{userId}/{name}`.
 * Reemplaza el patrón:
 *   const q = useMemoFirebase(() => {
 *     if (!db || !userId) return null;
 *     return query(collection(db, 'artifacts', APP_ID, 'users', userId, 'name'));
 *   }, [db, userId]);
 *   const { data } = useCollection<T>(q);
 *
 * Por:
 *   const { data } = useUserCollection<T>('name', userId);
 *
 * Soporta `constraints` (where/orderBy) opcionales.
 */
export function useUserCollection<T>(
  collectionName: string,
  userId: string | undefined,
  constraints?: QueryConstraint[],
) {
  const db = useFirestore();
  const q = useMemoFirebase<Query | CollectionReference | null>(() => {
    if (!db || !userId) return null;
    const ref = collection(db, 'artifacts', APP_ID, 'users', userId, collectionName);
    return constraints && constraints.length > 0 ? query(ref, ...constraints) : ref;
    // constraints deben venir memoizadas del caller (useMemo). No se serializan
    // aquí porque hacerlo correctamente requeriría comparación profunda — la
    // responsabilidad de estabilidad está en quien llama al hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, userId, collectionName]);

  return useCollection<T>(q as any);
}

// Re-export utilidades comunes para no tener que importarlas separado
export { orderByFn as orderBy, whereFn as where };
