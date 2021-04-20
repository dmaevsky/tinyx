type Subscriber<T> = (value: T) => void;
type Unsubscriber = () => void;
type Updater<T> = (value: T) => T;

interface Readable<T> {
  subscribe(subscriber: Subscriber<T>): Unsubscriber;
  get(): T;
}

interface DeepReadable<T> extends Readable<T> {
  get(...keyPath: KeyPath): unknown;
}

interface Writable<T> extends Readable<T> {
	set(value: T): boolean;
	update(updater: Updater<T>): boolean;
}

type KeyPath = unknown[];
type KeyPathNonEmpty = [NonNullable<unknown>, ...KeyPath];

type KeyPathAndValue = [...KeyPath, unknown];
type KeyPathAndUpdater = [...KeyPath, Updater<unknown>];
type KeyPathAndMutation = [...KeyPath, Mutation];

type Mutation = (ops: Partial<MutationToolbox>) => void;

interface MutationToolbox {
  get: (...keyPath: KeyPath) => unknown;
  set: (...keyPath: KeyPathAndValue) => void;
  update: (...keyPath: KeyPathAndUpdater) => void;
  remove: (...keyPath: KeyPath) => void;
  apply: (...keyPath: KeyPathAndMutation) => void;
}

type Reducer<T> = (state: T) => T;

type Diff<T> = {
  keyPath: KeyPath;
  oldValue: T | undefined;
  newValue: T | undefined;
}

type Recorder = (diff: Diff<any>) => void;
type Changes = Diff<any>[];

type Transaction = (payload: unknown) => Mutation;

interface Tinyx<T> extends DeepReadable<T> {
  commit(transaction: Transaction, payload: unknown, ...keyPath: KeyPath): Changes;
}

type Middleware<T, U = T> = (store: Tinyx<T>) => Tinyx<U>;

type Action<T> = (store: Tinyx<T>, ...args: unknown[]) => unknown;

type EqualsPredicate<T> = (a: T, b: T) => boolean;

declare module 'tinyx' {
  export function deepFreeze<T>(obj: T): Readonly<T>;

  export function getIn<T>(obj: T, ...keyPath: KeyPath): unknown;
  export function setIn<T>(obj: T, ...keyPath: KeyPathAndValue): Readonly<T>;
  export function updateIn<T>(obj: T, ...keyPath: KeyPathAndUpdater): Readonly<T>;
  export function deleteIn<T>(obj: T, ...keyPath: KeyPathNonEmpty): Readonly<T>;

  export function produce<T>(mutation: Mutation, record?: Recorder): Reducer<T>

  export function writable<T>(initialState: T, equals?: EqualsPredicate<T>): Writable<T>;

  export function tx<T>(initialState: T): Tinyx<Readonly<T>>;

  export function select<T>(store: Tinyx<T>, selector: (state: T) => KeyPath): Tinyx<unknown>;

  export function derived<T, U>(store: Readable<T>, selector: (state: T) => U, equals?: EqualsPredicate<U>): DeepReadable<U>;
}

declare module 'tinyx/middleware' {
  export default function applyMiddleware<T>(store: Tinyx<T>, middleware: Middleware<T>[]): Tinyx<T>;
}

declare module 'tinyx/middleware/logger' {
  export function logger<T>(print?: (...args: any[]) => void): Middleware<T>;
}

declare module 'tinyx/middleware/writable_traits' {
  export function SET<T>(value: T): Mutation;
  export function UPDATE<T>(updater: Updater<T>): Mutation;

  export default function withWritableTraits<T>(store: Tinyx<T>): Tinyx<T> & Writable<T>;
}

declare module 'tinyx/middleware/undo_redo' {
  type ChangeLog = {
    history: Changes;
    future: Changes;
  }

  export function enableUndoRedo<T>(store: Tinyx<T>): Tinyx<T & ChangeLog>;

  export function undoable<T>(action: Action<T>): Action<T>;

  export function undo<T>(store: Tinyx<T>): Changes;

  export function redo<T>(store: Tinyx<T>): Changes;
}
