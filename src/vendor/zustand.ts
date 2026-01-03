import { useRef, useSyncExternalStore } from 'react';

type Listener = () => void;

export type StateCreator<T> = (
  setState: StoreApi<T>['setState'],
  getState: StoreApi<T>['getState'],
) => T;

export type StoreApi<T> = {
  getState: () => T;
  setState: (
    partial: Partial<T> | ((state: T) => Partial<T>),
    replace?: boolean,
  ) => void;
  subscribe: (listener: Listener) => () => void;
};

const identity = <T,>(state: T) => state;

export function shallow<T extends Record<string, unknown>>(objA: T, objB: T): boolean {
  if (Object.is(objA, objB)) return true;
  if (
    typeof objA !== 'object' ||
    objA === null ||
    typeof objB !== 'object' ||
    objB === null
  ) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key)) return false;
    if (!Object.is((objA as Record<string, unknown>)[key], (objB as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
}

export function createStore<T>(creator: StateCreator<T>): StoreApi<T> {
  let state: T;
  const listeners = new Set<Listener>();

  const getState = () => state;
  const setState: StoreApi<T>['setState'] = (partial, replace = false) => {
    const nextState =
      typeof partial === 'function'
        ? (partial as (state: T) => Partial<T>)(state)
        : partial;

    state = replace ? (nextState as T) : { ...(state as object), ...nextState } as T;
    listeners.forEach((listener) => listener());
  };

  state = creator(setState, getState);

  return {
    getState,
    setState,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T, U>(
  store: StoreApi<T>,
  selector: (state: T) => U = identity as (state: T) => U,
  equalityFn: (a: U, b: U) => boolean = Object.is,
): U {
  const lastSnapshot = useRef<U>(selector(store.getState()));

  return useSyncExternalStore(
    (listener) =>
      store.subscribe(() => {
        const nextValue = selector(store.getState());
        if (!equalityFn(lastSnapshot.current, nextValue)) {
          lastSnapshot.current = nextValue;
          listener();
        }
      }),
    () => lastSnapshot.current,
    () => lastSnapshot.current,
  );
}
