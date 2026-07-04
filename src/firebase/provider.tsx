'use client';
import { APP_ID } from '@/lib/constants';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, onSnapshot } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged, signOut } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

// Internal state for user authentication
interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  isSuperAdmin: boolean; // Derived from the `superAdmin` custom claim on the ID token — única fuente de verdad
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean; // True if core services (app, firestore, auth instance) are provided
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null; // The Auth service instance
  // User authentication state
  user: User | null;
  isUserLoading: boolean; // True during initial auth check
  userError: Error | null; // Error from auth listener
  isSuperAdmin: boolean;
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  isSuperAdmin: boolean;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult { // Renamed from UserAuthHookResult for consistency if desired, or keep as UserAuthHookResult
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  isSuperAdmin: boolean;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true, // Start loading until first auth event
    userError: null,
    isSuperAdmin: false,
  });

  // Effect to subscribe to Firebase auth state changes
  useEffect(() => {
    if (!auth) { // If no Auth service instance, cannot determine user state
      setUserAuthState({ user: null, isUserLoading: false, userError: new Error("Auth service not provided."), isSuperAdmin: false });
      return;
    }

    setUserAuthState({ user: null, isUserLoading: true, userError: null, isSuperAdmin: false }); // Reset on auth instance change

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => { // Auth state determined
        if (!firebaseUser) {
          setUserAuthState({ user: null, isUserLoading: false, userError: null, isSuperAdmin: false });
          return;
        }
        // Custom claims (e.g. `superAdmin`) live on the ID token, not the User object —
        // must be read via getIdTokenResult() rather than derived from email/uid.
        firebaseUser.getIdTokenResult()
          .then((tokenResult) => {
            setUserAuthState({
              user: firebaseUser,
              isUserLoading: false,
              userError: null,
              isSuperAdmin: tokenResult.claims.superAdmin === true,
            });
          })
          .catch((error) => {
            console.error("FirebaseProvider: getIdTokenResult error:", error);
            setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null, isSuperAdmin: false });
          });
      },
      (error) => { // Auth listener error
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error, isSuperAdmin: false });
      }
    );
    return () => unsubscribe(); // Cleanup
  }, [auth]); // Depends on the auth instance

  // Cross-device session invalidation: if another device logs in, sign out this one.
  // Uses the same Firestore path as the rest of the app so security rules allow reads.
  useEffect(() => {
    const currentUser = userAuthState.user;
    if (!currentUser || !firestore) return;

    const userDocRef = doc(firestore, 'artifacts', APP_ID, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (snap) => {
      const data = snap.data();
      if (!data?.currentSessionId) return;

      // Use sessionStorage (not localStorage): it is empty on a fresh app
      // open, so a device that just opened the app — without a session
      // established this run — is never wrongly signed out. It is only set
      // after this device completes its own login.
      const storedSessionId = typeof window !== 'undefined'
        ? sessionStorage.getItem('agp_session_id')
        : null;

      if (!storedSessionId) return;

      if (data.currentSessionId !== storedSessionId) {
        sessionStorage.removeItem('agp_session_id');
        signOut(auth).finally(() => {
          window.location.href = '/login?reason=device';
        });
      }
    });

    return () => unsubscribe();
  }, [userAuthState.user, auth, firestore]);

  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
      isSuperAdmin: userAuthState.isSuperAdmin,
    };
  }, [firebaseApp, firestore, auth, userAuthState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

/**
 * Hook to access core Firebase services and user authentication state.
 * Throws error if core services are not available or used outside provider.
 */
export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
    isSuperAdmin: context.isSuperAdmin,
  };
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

/** Hook to access Firebase Storage instance. */
export const useStorage = (): FirebaseStorage => {
  const { firebaseApp } = useFirebase();
  return getStorage(firebaseApp);
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 * This provides the User object, loading status, and any auth errors.
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export const useUser = (): UserHookResult => { // Renamed from useAuthUser
  const { user, isUserLoading, userError, isSuperAdmin } = useFirebase(); // Leverages the main hook
  return { user, isUserLoading, userError, isSuperAdmin };
};