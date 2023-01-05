import {
  useQuery,
  UseQueryOptions,
  UseQueryResult,
  useMutation,
  UseMutationOptions,
  UseMutationResult,
  MutationFunction,
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  useQueryClient,
  QueryFunctionContext,
  QueryKey,
  UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { ZodiosError, ZodiosInstance } from "@zodios/core";
import type {
  AnyZodiosMethodOptions,
  Method,
  ZodiosPathsByMethod,
  ZodiosResponseByPath,
  ZodiosResponseByAlias,
  ZodiosEndpointDefinitions,
  ZodiosEndpointDefinition,
  ZodiosEndpointDefinitionByAlias,
  ZodiosRequestOptionsByPath,
  ZodiosRequestOptions,
  ZodiosBodyByPath,
  ZodiosBodyByAlias,
  ZodiosQueryParamsByPath,
  ZodiosRequestOptionsByAlias,
} from "@zodios/core";
import { AxiosError } from "axios";
import type {
  Aliases,
  MutationMethod,
  ZodiosAliases,
} from "@zodios/core/lib/zodios.types";
import type {
  IfEquals,
  PathParamNames,
  ReadonlyDeep,
  RequiredKeys,
} from "@zodios/core/lib/utils.types";
import { capitalize, pick, omit, combineSignals } from "./utils";

type UndefinedIfNever<T> = IfEquals<T, never, undefined, T>;
type Errors = Error | ZodiosError | AxiosError;

type MutationOptions<
  Api extends ZodiosEndpointDefinition[],
  M extends Method,
  Path extends ZodiosPathsByMethod<Api, M>
> = Omit<
  UseMutationOptions<
    Awaited<ZodiosResponseByPath<Api, M, Path>>,
    Errors,
    UndefinedIfNever<ZodiosBodyByPath<Api, M, Path>>
  >,
  "mutationFn"
>;

type MutationOptionsByAlias<
  Api extends ZodiosEndpointDefinition[],
  Alias extends string
> = Omit<
  UseMutationOptions<
    Awaited<ZodiosResponseByAlias<Api, Alias>>,
    Errors,
    UndefinedIfNever<ZodiosBodyByAlias<Api, Alias>>
  >,
  "mutationFn"
>;

export type QueryOptions<TQueryFnData, TData> = Omit<
  UseQueryOptions<TQueryFnData, Errors, TData>,
  "queryKey" | "queryFn"
>;

type ImmutableQueryOptions<TQueryFnData, TData> = Omit<
  UseQueryOptions<TQueryFnData, Errors, TData>,
  "queryKey" | "queryFn"
>;

type InfiniteQueryOptions<TQueryFnData, TData> = Omit<
  UseInfiniteQueryOptions<TQueryFnData, Errors, TData>,
  "queryKey" | "queryFn"
>;

export type ImmutableInfiniteQueryOptions<TQueryFnData, TData> = Omit<
  UseInfiniteQueryOptions<TQueryFnData, Errors, TData>,
  "queryKey" | "queryFn"
>;

export class ZodiosHooksClass<Api extends ZodiosEndpointDefinitions> {
  constructor(
    private readonly apiName: string,
    private readonly zodios: ZodiosInstance<Api>,
    private readonly options: { shouldAbortOnUnmount?: boolean } = {}
  ) {
    this.injectAliasEndpoints();
  }

  private injectAliasEndpoints() {
    this.zodios.api.forEach((endpoint) => {
      if (endpoint.alias) {
        if (["post", "put", "patch", "delete"].includes(endpoint.method)) {
          if (endpoint.method === "post" && endpoint.immutable) {
            (this as any)[`use${capitalize(endpoint.alias)}`] = (
              body: any,
              config: any,
              mutationOptions: any
            ) =>
              this.useImmutableQuery(
                endpoint.path as any,
                body,
                config,
                mutationOptions
              );
          } else {
            (this as any)[`use${capitalize(endpoint.alias)}`] = (
              config: any,
              mutationOptions: any
            ) =>
              this.useMutation(
                endpoint.method,
                endpoint.path as any,
                config,
                mutationOptions
              );
          }
        } else {
          (this as any)[`use${capitalize(endpoint.alias)}`] = (
            config: any,
            queryOptions: any
          ) => this.useQuery(endpoint.path as any, config, queryOptions);
        }
      }
    });
  }

  private getEndpointByPath(method: string, path: string) {
    return this.zodios.api.find(
      (endpoint) => endpoint.method === method && endpoint.path === path
    );
  }

  private getEndpointByAlias(alias: string) {
    return this.zodios.api.find((endpoint) => endpoint.alias === alias);
  }

  /**
   * compute the key for the provided endpoint
   * @param method - HTTP method of the endpoint
   * @param path - path for the endpoint
   * @param config - parameters of the api to the endpoint - when providing no parameters, will return the common key for the endpoint
   * @returns - Key
   */
  getKeyByPath<M extends Method, Path extends ZodiosPathsByMethod<Api, Method>>(
    method: M,
    path: Path extends ZodiosPathsByMethod<Api, M> ? Path : never,
    config?: ZodiosRequestOptionsByPath<Api, M, Path>
  ) {
    const endpoint = this.getEndpointByPath(method, path);
    if (!endpoint)
      throw new Error(`No endpoint found for path '${method} ${path}'`);
    if (config) {
      const params = pick(config as AnyZodiosMethodOptions | undefined, [
        "params",
        "queries",
      ]);
      return [{ api: this.apiName, path: endpoint.path }, params] as QueryKey;
    }
    return [{ api: this.apiName, path: endpoint.path }] as QueryKey;
  }

  /**
   * compute the key for the provided endpoint alias
   * @param alias - alias of the endpoint
   * @param config - parameters of the api to the endpoint
   * @returns - QueryKey
   */
  getKeyByAlias<Alias extends keyof ZodiosAliases<Api>>(
    alias: Alias extends string ? Alias : never,
    config?: Alias extends string
      ? ZodiosRequestOptionsByAlias<Api, Alias>
      : never
  ) {
    const endpoint = this.getEndpointByAlias(alias);
    if (!endpoint) throw new Error(`No endpoint found for alias '${alias}'`);
    if (config) {
      const params = pick(config as AnyZodiosMethodOptions | undefined, [
        "params",
        "queries",
      ]);
      return [{ api: this.apiName, path: endpoint.path }, params] as QueryKey;
    }
    return [{ api: this.apiName, path: endpoint.path }] as QueryKey;
  }

  useQuery<
    Path extends ZodiosPathsByMethod<Api, "get">,
    TConfig extends ZodiosRequestOptionsByPath<Api, "get", Path>,
    TQueryFnData = ZodiosResponseByPath<Api, "get", Path>,
    TData = ZodiosResponseByPath<Api, "get", Path>
  >(
    path: Path,
    ...[config, queryOptions]: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          queryOptions?: QueryOptions<TQueryFnData, TData>
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          queryOptions?: QueryOptions<TQueryFnData, TData>
        ]
  ) {
    const params = pick(config as AnyZodiosMethodOptions | undefined, [
      "params",
      "queries",
    ]);
    const key = [{ api: this.apiName, path }, params] as QueryKey;
    const query = this.options.shouldAbortOnUnmount
      ? ({ signal }: { signal?: AbortSignal }) =>
          this.zodios.get(path, {
            ...(config as any),
            signal: combineSignals(signal, (config as any)?.signal),
          })
      : () => this.zodios.get(path, config as any);
    const queryClient = useQueryClient();
    const invalidate = () => queryClient.invalidateQueries(key);
    return {
      invalidate,
      key,
      ...useQuery(key, query, queryOptions),
    } as UseQueryResult<TData, Errors> & {
      invalidate: () => Promise<void>;
      key: QueryKey;
    };
  }

  useImmutableQuery<
    Path extends ZodiosPathsByMethod<Api, "post">,
    TConfig extends ZodiosRequestOptionsByPath<Api, "post", Path>,
    TQueryFnData = ZodiosResponseByPath<Api, "post", Path>,
    TData = ZodiosResponseByPath<Api, "post", Path>
  >(
    path: Path,
    body: ReadonlyDeep<UndefinedIfNever<ZodiosBodyByPath<Api, "post", Path>>>,
    ...[config, queryOptions]: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          queryOptions?: ImmutableQueryOptions<TQueryFnData, TData>
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          queryOptions?: ImmutableQueryOptions<TQueryFnData, TData>
        ]
  ): UseQueryResult<TData, Errors> & {
    invalidate: () => Promise<void>;
    key: QueryKey;
  } {
    const params = pick(config as AnyZodiosMethodOptions | undefined, [
      "params",
      "queries",
    ]);
    const key = [{ api: this.apiName, path }, params, body] as QueryKey;
    const query = this.options.shouldAbortOnUnmount
      ? ({ signal }: { signal?: AbortSignal }) =>
          this.zodios.post(path, body, {
            ...(config as any),
            signal: combineSignals(signal, (config as any)?.signal),
          })
      : () => this.zodios.post(path, body, config as any);
    const queryClient = useQueryClient();
    const invalidate = () => queryClient.invalidateQueries(key);
    return {
      invalidate,
      key,
      ...useQuery(key, query, queryOptions),
    };
  }

  useInfiniteQuery<
    Path extends ZodiosPathsByMethod<Api, "get">,
    TConfig extends ZodiosRequestOptionsByPath<Api, "get", Path>,
    TQueryFnData = ZodiosResponseByPath<Api, "get", Path>,
    TData = ZodiosResponseByPath<Api, "get", Path>
  >(
    path: Path,
    ...[config, queryOptions]: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          queryOptions?: InfiniteQueryOptions<TQueryFnData, TData> & {
            getPageParamList: () => (
              | (ZodiosQueryParamsByPath<Api, "get", Path> extends never
                  ? never
                  : keyof ZodiosQueryParamsByPath<Api, "get", Path>)
              | PathParamNames<Path>
            )[];
          }
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          queryOptions?: InfiniteQueryOptions<TQueryFnData, TData> & {
            getPageParamList: () => (
              | (ZodiosQueryParamsByPath<Api, "get", Path> extends never
                  ? never
                  : keyof ZodiosQueryParamsByPath<Api, "get", Path>)
              | PathParamNames<Path>
            )[];
          }
        ]
  ): UseInfiniteQueryResult<TData, Errors> & {
    invalidate: () => Promise<void>;
    key: QueryKey;
  } {
    const params = pick(config as AnyZodiosMethodOptions | undefined, [
      "params",
      "queries",
    ]);
    // istanbul ignore next
    if (params.params && queryOptions) {
      params.params = omit(
        params.params,
        queryOptions.getPageParamList() as string[]
      );
    }
    if (params.queries && queryOptions) {
      params.queries = omit(
        params.queries,
        queryOptions.getPageParamList() as string[]
      );
    }
    const key = [{ api: this.apiName, path }, params];
    const query = this.options.shouldAbortOnUnmount
      ? ({ pageParam = undefined, signal }: QueryFunctionContext) =>
          this.zodios.get(path, {
            ...config,
            queries: {
              ...(config as AnyZodiosMethodOptions)?.queries,
              ...(pageParam as AnyZodiosMethodOptions)?.queries,
            },
            params: {
              ...(config as AnyZodiosMethodOptions)?.params,
              ...(pageParam as AnyZodiosMethodOptions)?.params,
            },
            signal: combineSignals(signal, (config as any)?.signal),
          } as unknown as ReadonlyDeep<TConfig>)
      : ({ pageParam = undefined }: QueryFunctionContext) =>
          this.zodios.get(path, {
            ...config,
            queries: {
              ...(config as AnyZodiosMethodOptions)?.queries,
              ...(pageParam as AnyZodiosMethodOptions)?.queries,
            },
            params: {
              ...(config as AnyZodiosMethodOptions)?.params,
              ...(pageParam as AnyZodiosMethodOptions)?.params,
            },
          } as unknown as ReadonlyDeep<TConfig>);
    const queryClient = useQueryClient();
    const invalidate = () => queryClient.invalidateQueries(key);
    return {
      invalidate,
      key,
      ...useInfiniteQuery(
        key,
        query,
        queryOptions as Omit<typeof queryOptions, "getPageParamList">
      ),
    };
  }

  useImmutableInfiniteQuery<
    Path extends ZodiosPathsByMethod<Api, "post">,
    TConfig extends ZodiosRequestOptionsByPath<Api, "post", Path>,
    TQueryFnData = ZodiosResponseByPath<Api, "post", Path>,
    TData = ZodiosResponseByPath<Api, "post", Path>
  >(
    path: Path,
    body: ReadonlyDeep<UndefinedIfNever<ZodiosBodyByPath<Api, "post", Path>>>,
    ...[config, queryOptions]: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          queryOptions?: ImmutableInfiniteQueryOptions<TQueryFnData, TData> & {
            getPageParamList: () => (
              | keyof ZodiosBodyByPath<Api, "post", Path>
              | PathParamNames<Path>
              | (ZodiosQueryParamsByPath<Api, "post", Path> extends never
                  ? never
                  : keyof ZodiosQueryParamsByPath<Api, "post", Path>)
            )[];
          }
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          queryOptions?: ImmutableInfiniteQueryOptions<TQueryFnData, TData> & {
            getPageParamList: () => (
              | keyof ZodiosBodyByPath<Api, "post", Path>
              | PathParamNames<Path>
              | (ZodiosQueryParamsByPath<Api, "post", Path> extends never
                  ? never
                  : keyof ZodiosQueryParamsByPath<Api, "post", Path>)
            )[];
          }
        ]
  ): UseInfiniteQueryResult<TData, Errors> & {
    invalidate: () => Promise<void>;
    key: QueryKey;
  } {
    const params = pick(config as AnyZodiosMethodOptions | undefined, [
      "params",
      "queries",
    ]);
    // istanbul ignore next
    if (params.params && queryOptions) {
      params.params = omit(
        params.params,
        queryOptions.getPageParamList() as string[]
      );
    }
    // istanbul ignore next
    if (params.queries && queryOptions) {
      params.queries = omit(
        params.queries,
        queryOptions.getPageParamList() as string[]
      );
    }
    let bodyKey;
    if (body && queryOptions) {
      bodyKey = omit(
        body,
        queryOptions.getPageParamList() as (keyof typeof body)[]
      );
    }
    const key = [{ api: this.apiName, path }, params, bodyKey];
    const query = this.options.shouldAbortOnUnmount
      ? ({ pageParam = undefined, signal }: QueryFunctionContext) =>
          this.zodios.post(
            path,
            {
              ...body,
              ...(pageParam as any)?.body,
            },
            {
              ...config,
              queries: {
                ...(config as AnyZodiosMethodOptions)?.queries,
                ...(pageParam as AnyZodiosMethodOptions)?.queries,
              },
              params: {
                ...(config as AnyZodiosMethodOptions)?.params,
                ...(pageParam as AnyZodiosMethodOptions)?.params,
              },
              signal: combineSignals(signal, (config as any)?.signal),
            } as unknown as ReadonlyDeep<TConfig>
          )
      : ({ pageParam = undefined }: QueryFunctionContext) =>
          this.zodios.post(
            path,
            {
              ...body,
              ...(pageParam as any)?.body,
            },
            {
              ...config,
              queries: {
                ...(config as AnyZodiosMethodOptions)?.queries,
                ...(pageParam as AnyZodiosMethodOptions)?.queries,
              },
              params: {
                ...(config as AnyZodiosMethodOptions)?.params,
                ...(pageParam as AnyZodiosMethodOptions)?.params,
              },
            } as unknown as ReadonlyDeep<TConfig>
          );
    const queryClient = useQueryClient();
    const invalidate = () => queryClient.invalidateQueries(key);
    return {
      invalidate,
      key,
      ...useInfiniteQuery(
        key,
        query,
        queryOptions as Omit<typeof queryOptions, "getPageParamList">
      ),
    };
  }

  useMutation<
    M extends Method,
    Path extends ZodiosPathsByMethod<Api, M>,
    TConfig extends ZodiosRequestOptionsByPath<Api, M, Path>
  >(
    method: M,
    path: Path,
    ...[config, mutationOptions]: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, M, Path>
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, M, Path>
        ]
  ) {
    type MutationVariables = UndefinedIfNever<ZodiosBodyByPath<Api, M, Path>>;

    const mutation: MutationFunction<
      ZodiosResponseByPath<Api, M, Path>,
      MutationVariables
    > = (variables: MutationVariables) => {
      return this.zodios.request({
        ...config,
        method,
        url: path,
        data: variables,
      } as unknown as ZodiosRequestOptions<Api, M, Path>);
    };
    return useMutation(mutation, mutationOptions);
  }

  useGet<
    Path extends ZodiosPathsByMethod<Api, "get">,
    TConfig extends ZodiosRequestOptionsByPath<Api, "get", Path>,
    TQueryFnData = ZodiosResponseByPath<Api, "get", Path>,
    TData = ZodiosResponseByPath<Api, "get", Path>
  >(
    path: Path,
    ...rest: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          queryOptions?: QueryOptions<TQueryFnData, TData>
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          queryOptions?: QueryOptions<TQueryFnData, TData>
        ]
  ): UseQueryResult<TData, Errors> & {
    invalidate: () => Promise<void>;
    key: QueryKey;
  } {
    return this.useQuery(path, ...(rest as any[]));
  }

  usePost<
    Path extends ZodiosPathsByMethod<Api, "post">,
    TConfig extends ZodiosRequestOptionsByPath<Api, "post", Path>
  >(
    path: Path,
    ...rest: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, "post", Path>
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, "post", Path>
        ]
  ) {
    // @ts-expect-error
    return this.useMutation("post", path, ...rest);
  }

  usePut<
    Path extends ZodiosPathsByMethod<Api, "put">,
    TConfig extends ZodiosRequestOptionsByPath<Api, "put", Path>
  >(
    path: Path,
    ...rest: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, "put", Path>
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, "put", Path>
        ]
  ) {
    // @ts-expect-error
    return this.useMutation("put", path, ...rest);
  }

  usePatch<
    Path extends ZodiosPathsByMethod<Api, "patch">,
    TConfig extends ZodiosRequestOptionsByPath<Api, "patch", Path>
  >(
    path: Path,
    ...rest: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, "patch", Path>
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, "patch", Path>
        ]
  ) {
    // @ts-expect-error
    return this.useMutation("patch", path, ...rest);
  }

  useDelete<
    Path extends ZodiosPathsByMethod<Api, "delete">,
    TConfig extends ZodiosRequestOptionsByPath<Api, "delete", Path>
  >(
    path: Path,
    ...rest: RequiredKeys<TConfig> extends never
      ? [
          config?: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, "delete", Path>
        ]
      : [
          config: ReadonlyDeep<TConfig>,
          mutationOptions?: MutationOptions<Api, "delete", Path>
        ]
  ) {
    // @ts-expect-error
    return this.useMutation("delete", path, ...rest);
  }
}

export type ZodiosMutationAliasHook<Body, Config, MutationOptions, Response> =
  RequiredKeys<Config> extends never
    ? (
        configOptions?: ReadonlyDeep<Config>,
        mutationOptions?: MutationOptions
      ) => UseMutationResult<Response, Errors, UndefinedIfNever<Body>, unknown>
    : (
        configOptions: ReadonlyDeep<Config>,
        mutationOptions?: MutationOptions
      ) => UseMutationResult<Response, Errors, UndefinedIfNever<Body>, unknown>;

export type ZodiosHooksAliases<Api extends ZodiosEndpointDefinition[]> = {
  [Alias in Aliases<Api> as `use${Capitalize<Alias>}`]: ZodiosEndpointDefinitionByAlias<
    Api,
    Alias
  >[number]["method"] extends infer AliasMethod
    ? AliasMethod extends MutationMethod
      ? {
          immutable: ZodiosEndpointDefinitionByAlias<
            Api,
            Alias
          >[number]["immutable"];
          method: AliasMethod;
        } extends { immutable: true; method: "post" }
        ? // immutable query
          <
            TConfig extends ZodiosRequestOptionsByAlias<Api, Alias>,
            TQueryFnData = ZodiosResponseByAlias<Api, Alias>,
            TData = ZodiosResponseByAlias<Api, Alias>
          >(
            body: ReadonlyDeep<UndefinedIfNever<ZodiosBodyByAlias<Api, Alias>>>,
            ...[config, queryOptions]: RequiredKeys<TConfig> extends never
              ? [
                  config?: ReadonlyDeep<TConfig>,
                  queryOptions?: ImmutableQueryOptions<TQueryFnData, TData>
                ]
              : [
                  config: ReadonlyDeep<TConfig>,
                  queryOptions?: ImmutableQueryOptions<TQueryFnData, TData>
                ]
          ) => UseQueryResult<TData, Errors> & {
            invalidate: () => Promise<void>;
            key: QueryKey;
          }
        : // useMutation
          ZodiosMutationAliasHook<
            ZodiosBodyByAlias<Api, Alias>,
            ZodiosRequestOptionsByAlias<Api, Alias>,
            MutationOptionsByAlias<Api, Alias>,
            ZodiosResponseByAlias<Api, Alias>
          >
      : // useQuery
        <
          Config extends ZodiosRequestOptionsByAlias<Api, Alias>,
          TQueryFnData = ZodiosResponseByAlias<Api, Alias>,
          TData = ZodiosResponseByAlias<Api, Alias>
        >(
          ...rest: RequiredKeys<Config> extends never
            ? [
                configOptions?: ReadonlyDeep<Config>,
                queryOptions?: QueryOptions<TQueryFnData, TData>
              ]
            : [
                configOptions: ReadonlyDeep<Config>,
                queryOptions?: QueryOptions<TQueryFnData, TData>
              ]
        ) => UseQueryResult<TData, Errors> & {
          invalidate: () => Promise<void>;
          key: QueryKey;
        }
    : never;
};

export type ZodiosHooksInstance<Api extends ZodiosEndpointDefinitions> =
  ZodiosHooksClass<Api> & ZodiosHooksAliases<Api>;

export type ZodiosHooksConstructor = {
  new <Api extends ZodiosEndpointDefinitions>(
    name: string,
    zodios: ZodiosInstance<Api>,
    options?: { shouldAbortOnUnmount?: boolean }
  ): ZodiosHooksInstance<Api>;
};

export const ZodiosHooks = ZodiosHooksClass as ZodiosHooksConstructor;
