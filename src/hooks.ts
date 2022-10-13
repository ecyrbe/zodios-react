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
  ZodiosMethodOptions,
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
} from "@zodios/core/lib/utils.types";
import { capitalize, pick, omit } from "./utils";

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

type QueryOptions<
  Api extends ZodiosEndpointDefinition[],
  Path extends ZodiosPathsByMethod<Api, "get">
> = Awaited<UseQueryOptions<ZodiosResponseByPath<Api, "get", Path>, Errors>>;

type QueryOptionsByAlias<
  Api extends ZodiosEndpointDefinition[],
  Alias extends string
> = Awaited<UseQueryOptions<ZodiosResponseByAlias<Api, Alias>, Errors>>;

type ImmutableQueryOptions<
  Api extends ZodiosEndpointDefinition[],
  M extends Method,
  Path extends ZodiosPathsByMethod<Api, M>
> = Awaited<UseQueryOptions<ZodiosResponseByPath<Api, M, Path>, Errors>>;

type InfiniteQueryOptions<
  Api extends ZodiosEndpointDefinition[],
  Path extends ZodiosPathsByMethod<Api, "get">
> = Awaited<
  UseInfiniteQueryOptions<ZodiosResponseByPath<Api, "get", Path>, Errors>
>;

export type ImmutableInfiniteQueryOptions<
  Api extends ZodiosEndpointDefinition[],
  M extends Method,
  Path extends ZodiosPathsByMethod<Api, M>
> = Awaited<
  UseInfiniteQueryOptions<ZodiosResponseByPath<Api, M, Path>, Errors>
>;

export class ZodiosHooksClass<Api extends ZodiosEndpointDefinitions> {
  constructor(
    private readonly apiName: string,
    private readonly zodios: ZodiosInstance<Api>
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
    config?: ZodiosMethodOptions<Api, M, Path>
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
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "get", Path>>
  >(
    path: Path,
    config?: TConfig,
    queryOptions?: Omit<QueryOptions<Api, Path>, "queryKey" | "queryFn">
  ) {
    const params = pick(config as AnyZodiosMethodOptions | undefined, [
      "params",
      "queries",
    ]);
    const key = [{ api: this.apiName, path }, params] as QueryKey;
    const query = () => this.zodios.get(path, config);
    const queryClient = useQueryClient();
    const invalidate = () => queryClient.invalidateQueries(key);
    return {
      invalidate,
      key,
      ...useQuery(key, query, queryOptions),
    } as UseQueryResult<ZodiosResponseByPath<Api, "get", Path>, Errors> & {
      invalidate: () => Promise<void>;
      key: QueryKey;
    };
  }

  useImmutableQuery<
    Path extends ZodiosPathsByMethod<Api, "post">,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "post", Path>>
  >(
    path: Path,
    body?: ReadonlyDeep<ZodiosBodyByPath<Api, "post", Path>>,
    config?: TConfig,
    queryOptions?: Omit<
      ImmutableQueryOptions<Api, "post", Path>,
      "queryKey" | "queryFn"
    >
  ) {
    const params = pick(config as AnyZodiosMethodOptions | undefined, [
      "params",
      "queries",
    ]);
    const key = [{ api: this.apiName, path }, params, body] as QueryKey;
    const query = () => this.zodios.post(path, body, config);
    const queryClient = useQueryClient();
    const invalidate = () => queryClient.invalidateQueries(key);
    return {
      invalidate,
      key,
      ...useQuery(key, query, queryOptions),
    } as UseQueryResult<ZodiosResponseByPath<Api, "post", Path>, Errors> & {
      invalidate: () => Promise<void>;
      key: QueryKey;
    };
  }

  useInfiniteQuery<
    Path extends ZodiosPathsByMethod<Api, "get">,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "get", Path>>
  >(
    path: Path,
    config?: TConfig,
    queryOptions?: Omit<
      InfiniteQueryOptions<Api, Path>,
      "queryKey" | "queryFn"
    > & {
      getPageParamList: () => (
        | (ZodiosQueryParamsByPath<Api, "get", Path> extends never
            ? never
            : keyof ZodiosQueryParamsByPath<Api, "get", Path>)
        | PathParamNames<Path>
      )[];
    }
  ) {
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
    const query = ({ pageParam = undefined }: QueryFunctionContext) =>
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
      } as unknown as TConfig);
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
    } as UseInfiniteQueryResult<
      ZodiosResponseByPath<Api, "get", Path>,
      Errors
    > & {
      invalidate: () => Promise<void>;
      key: QueryKey;
    };
  }

  useImmutableInfiniteQuery<
    Path extends ZodiosPathsByMethod<Api, "post">,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "post", Path>>
  >(
    path: Path,
    body?: ReadonlyDeep<ZodiosBodyByPath<Api, "post", Path>>,
    config?: TConfig,
    queryOptions?: Omit<
      ImmutableInfiniteQueryOptions<Api, "post", Path>,
      "queryKey" | "queryFn"
    > & {
      getPageParamList: () => (
        | keyof ZodiosBodyByPath<Api, "post", Path>
        | PathParamNames<Path>
        | (ZodiosQueryParamsByPath<Api, "post", Path> extends never
            ? never
            : keyof ZodiosQueryParamsByPath<Api, "post", Path>)
      )[];
    }
  ) {
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
    const query = ({ pageParam = undefined }: QueryFunctionContext) =>
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
        } as unknown as TConfig
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
    } as UseInfiniteQueryResult<
      ZodiosResponseByPath<Api, "post", Path>,
      Errors
    > & {
      invalidate: () => Promise<void>;
      key: QueryKey;
    };
  }

  useMutation<
    M extends Method,
    Path extends ZodiosPathsByMethod<Api, M>,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, M, Path>>
  >(
    method: M,
    path: Path,
    config?: TConfig,
    mutationOptions?: MutationOptions<Api, M, Path>
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
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "get", Path>>
  >(
    path: Path,
    config?: TConfig,
    queryOptions?: Omit<QueryOptions<Api, Path>, "queryKey" | "queryFn">
  ) {
    return this.useQuery(path, config, queryOptions);
  }

  usePost<
    Path extends ZodiosPathsByMethod<Api, "post">,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "post", Path>>
  >(
    path: Path,
    config?: TConfig,
    mutationOptions?: MutationOptions<Api, "post", Path>
  ) {
    return this.useMutation("post", path, config, mutationOptions);
  }

  usePut<
    Path extends ZodiosPathsByMethod<Api, "put">,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "put", Path>>
  >(
    path: Path,
    config?: TConfig,
    mutationOptions?: MutationOptions<Api, "put", Path>
  ) {
    return this.useMutation("put", path, config, mutationOptions);
  }

  usePatch<
    Path extends ZodiosPathsByMethod<Api, "patch">,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "patch", Path>>
  >(
    path: Path,
    config?: TConfig,
    mutationOptions?: MutationOptions<Api, "patch", Path>
  ) {
    return this.useMutation("patch", path, config, mutationOptions);
  }

  useDelete<
    Path extends ZodiosPathsByMethod<Api, "delete">,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "delete", Path>>
  >(
    path: Path,
    config?: TConfig,
    mutationOptions?: MutationOptions<Api, "delete", Path>
  ) {
    return this.useMutation("delete", path, config, mutationOptions);
  }
}

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
        ? (
            body: ReadonlyDeep<ZodiosBodyByAlias<Api, Alias>>,
            configOptions?: ZodiosRequestOptionsByAlias<Api, Alias>,
            queryOptions?: Omit<
              QueryOptionsByAlias<Api, Alias>,
              "queryKey" | "queryFn"
            >
          ) => UseQueryResult<ZodiosResponseByAlias<Api, Alias>, Errors> & {
            invalidate: () => Promise<void>;
            key: QueryKey;
          }
        : (
            configOptions?: ZodiosRequestOptionsByAlias<Api, Alias>,
            mutationOptions?: MutationOptionsByAlias<Api, Alias>
          ) => UseMutationResult<
            ZodiosResponseByAlias<Api, Alias>,
            Errors,
            UndefinedIfNever<ZodiosBodyByAlias<Api, Alias>>,
            unknown
          >
      : (
          configOptions?: ZodiosRequestOptionsByAlias<Api, Alias>,
          queryOptions?: Omit<
            QueryOptionsByAlias<Api, Alias>,
            "queryKey" | "queryFn"
          >
        ) => UseQueryResult<ZodiosResponseByAlias<Api, Alias>, Errors> & {
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
    zodios: ZodiosInstance<Api>
  ): ZodiosHooksInstance<Api>;
};

export const ZodiosHooks = ZodiosHooksClass as ZodiosHooksConstructor;
