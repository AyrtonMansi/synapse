/**
 * Utility Type Definitions
 * 
 * @module synapse-core/utils/types
 * @description Shared TypeScript utility types
 */

/**
 * Make all properties in T optional recursively
 * @template T Type to make partial
 * 
 * @example
 * ```typescript
 * type Config = { db: { host: string; port: number } };
 * type PartialConfig = DeepPartial<Config>;
 * // { db?: { host?: string; port?: number } }
 * ```
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make all properties in T readonly recursively
 * @template T Type to make readonly
 * 
 * @example
 * ```typescript
 * type Config = { db: { host: string } };
 * type ImmutableConfig = DeepReadonly<Config>;
 * // { readonly db: { readonly host: string } }
 * ```
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Make properties K of T optional
 * @template T Source type
 * @template K Keys to make optional
 * 
 * @example
 * ```typescript
 * type User = { id: string; name: string; email: string };
 * type PartialUser = Optional<User, 'email'>;
 * // { id: string; name: string; email?: string }
 * ```
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make all properties nullable
 * @template T Type to make nullable
 */
export type Nullable<T> = { [P in keyof T]: T[P] | null };

/**
 * Make all properties non-nullable
 * @template T Type to make non-nullable
 */
export type NonNullable<T> = { [P in keyof T]-?: Exclude<T[P], null | undefined> };

/**
 * Get return type of async function
 * @template T Async function type
 * 
 * @example
 * ```typescript
 * async function fetchUser(): Promise<User> { ... }
 * type UserType = AsyncReturnType<typeof fetchUser>;
 * // User
 * ```
 */
export type AsyncReturnType<T extends (...args: unknown[]) => Promise<unknown>> = 
  T extends (...args: unknown[]) => Promise<infer R> ? R : never;

/**
 * Get union of all value types in object
 * @template T Object type
 * 
 * @example
 * ```typescript
 * type Config = { a: string; b: number; c: boolean };
 * type ConfigValue = ValueOf<Config>;
 * // string | number | boolean
 * ```
 */
export type ValueOf<T> = T[keyof T];

/**
 * Get union of all keys in object
 * @template T Object type
 */
export type KeysOf<T> = keyof T;

/**
 * Require at least one of the specified keys
 * @template T Source type
 * @template K Keys where at least one is required
 * 
 * @example
 * ```typescript
 * type Search = { query?: string; id?: string };
 * type ValidSearch = AtLeastOne<Search, 'query' | 'id'>;
 * // Requires query or id or both
 * ```
 */
export type AtLeastOne<T, K extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, K>> & 
  { [P in K]-?: Required<Pick<T, P>> & Partial<Pick<T, Exclude<K, P>>> }[K];

/**
 * Make object properties mutable (remove readonly)
 * @template T Type to make mutable
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Extract keys of a specific type
 * @template T Object type
 * @template V Value type to match
 * 
 * @example
 * ```typescript
 * type Config = { name: string; port: number; debug: boolean };
 * type StringKeys = KeysOfType<Config, string>;
 * // 'name'
 * ```
 */
export type KeysOfType<T, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

/**
 * Flatten nested object type
 * @template T Object type to flatten
 * 
 * @example
 * ```typescript
 * type Nested = { a: { b: { c: string } } };
 * type Flat = Flatten<Nested>;
 * // { 'a.b.c': string }
 * ```
 */
export type Flatten<T, Prefix extends string = ''> = {
  [K in keyof T]: T[K] extends object 
    ? Flatten<T[K], `${Prefix}${K & string}.`>
    : { [P in `${Prefix}${K & string}`]: T[K] };
}[keyof T];

/**
 * Create a tuple type of specific length
 * @template T Element type
 * @template N Length
 */
export type Tuple<T, N extends number> = N extends N 
  ? number extends N 
    ? T[] 
    : _TupleOf<T, N, []> 
  : never;

type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N 
  ? R 
  : _TupleOf<T, N, [T, ...R]>;

/**
 * Brand type for nominal typing
 * @template T Base type
 * @template B Brand name
 * 
 * @example
 * ```typescript
 * type UserId = Brand<string, 'UserId'>;
 * type PostId = Brand<string, 'PostId'>;
 * 
 * const userId: UserId = '123' as UserId;
 * const postId: PostId = '456' as PostId;
 * 
 * // Type error: UserId not assignable to PostId
 * ```
 */
export type Brand<T, B> = T & { __brand: B };

/**
 * Result type for explicit error handling
 * @template T Success type
 * @template E Error type
 * 
 * @example
 * ```typescript
 * type Result<T> = 
 *   | { ok: true; value: T }
 *   | { ok: false; error: Error };
 * 
 * const result = mightFail();
 * if (result.ok) {
 *   console.log(result.value);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export type Result<T, E = Error> = 
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * Pagination parameters
 */
export interface PaginationParams {
  readonly page: number;
  readonly limit: number;
}

/**
 * Paginated response
 * @template T Item type
 */
export interface PaginatedResponse<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPrevPage: boolean;
}

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort parameters
 */
export interface SortParams<T extends string = string> {
  readonly field: T;
  readonly direction: SortDirection;
}

/**
 * Range filter
 * @template T Range value type
 */
export interface RangeFilter<T> {
  readonly min?: T;
  readonly max?: T;
}

/**
 * API response wrapper
 * @template T Data type
 */
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
  readonly meta?: {
    readonly requestId: string;
    readonly timestamp: string;
    readonly pagination?: PaginatedResponse<T>;
  };
}
