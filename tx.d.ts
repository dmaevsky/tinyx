declare type Operations = {
  get: (...keyPath: string[]) => object;
  set: (...keyPath: string[]) => object;
  update: (...keyPath: string[]) => object;
  remove: (...keyPath: string[]) => object;
  apply: (...keyPath: string[]) => object;
  subscribe(state: object): void;
  commit(transaction: Function, payload: unknown, ...keyPath: string[]): unknown[];
}

declare module 'tinyx' {
  export function deepFreeze<T extends object, U extends T>(obj: T): U;

  export function getIn<T extends object>(obj: T, ...keyPath: string[]): T;

  export function setIn<T extends object, U extends T>(obj: T, ...keyPath: string[]): U;

  export function updateIn<T extends object, U extends T>(obj: T, ...keyPath: string[]): U;

  export function deleteIn<T extends object, U extends T>(obj: T, key: string, ...path: string[]): U;

  export function produce<T extends object, U extends T>(mutation: (operations: Omit<Operations, 'subscribe' | 'commit'>) => object, record?: Function): (state: T) => U;

  export function tx(operations: {
    update<T extends object, U extends T>(state: T): U;
    subscribe(state: object): void;
  }): Pick<Operations, 'get' | 'subscribe' | 'commit'>;

  export function select(operations: Pick<Operations, 'get' | 'subscribe' | 'commit'>, selector: Function): Pick<Operations, 'get' | 'subscribe' | 'commit'>;

  export function derived<T>(operations: Pick<Operations, 'get' | 'subscribe'>, selector: Function, equals?: (a: T, b: T) => boolean): Pick<Operations, 'get' | 'subscribe'>;
}

declare module 'tinyx/middleware' {
  export default function applyMiddleware(store: Partial<Operations>, middleware: any[]): any;
}

declare module 'tinyx/middleware/logger' {
  export default function txLogger<T extends Partial<Operations>>(operations: T): T;
}

declare module 'tinyx/middleware/undo_redo' {
  export function enableUndoRedo<T extends Partial<Operations>>(operations: T): T;

  export function undoable<T extends Partial<Operations>>(action: (store: T, task: unknown) => unknown[]): (store: T, ...args: string[]) => unknown;

  export function undo(store: Partial<Operations>): unknown;

  export function redo(store: Partial<Operations>): unknown;
}
