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
} from "react-query";
import { ZodiosInstance } from "@zodios/core";
import type {
  AnyZodiosMethodOptions,
  Body,
  Method,
  Paths,
  Response,
  ZodiosEnpointDescriptions,
  ZodiosMethodOptions,
  ZodiosRequestOptions,
} from "@zodios/core";
import { capitalize, pick, omit } from "./utils";
import type {
  AliasEndpointApiDescription,
  Aliases,
  BodyByAlias,
  MutationMethod,
  QueryParams,
  ResponseByAlias,
  ZodiosConfigByAlias,
} from "@zodios/core/lib/zodios.types";
import type {
  IfEquals,
  MergeUnion,
  PathParamNames,
  ReadonlyDeep,
} from "@zodios/core/lib/utils.types";

type UndefinedIfNever<T> = IfEquals<T, never, undefined, T>;

type MutationOptions<
  Api extends unknown[],
  M extends Method,
  Path extends Paths<Api, M>
> = Omit<
  UseMutationOptions<
    Awaited<Response<Api, M, Path>>,
    unknown,
    UndefinedIfNever<Body<Api, M, Path>>
  >,
  "mutationFn"
>;

type QueryOptions<
  Api extends unknown[],
  Path extends Paths<Api, "get">
> = Awaited<UseQueryOptions<Response<Api, "get", Path>>>;

type ImmutableQueryOptions<
  Api extends unknown[],
  M extends Method,
  Path extends Paths<Api, M>
> = Awaited<UseQueryOptions<Response<Api, M, Path>>>;

type InfiniteQueryOptions<
  Api extends unknown[],
  Path extends Paths<Api, "get">
> = Awaited<UseInfiniteQueryOptions<Response<Api, "get", Path>>>;

export type ImmutableInfiniteQueryOptions<
  Api extends unknown[],
  M extends Method,
  Path extends Paths<Api, M>
> = Awaited<UseInfiniteQueryOptions<Response<Api, M, Path>>>;

type MutationOptionsByAlias<Api extends unknown[], Alias extends string> = Omit<
  UseMutationOptions<
    Awaited<ResponseByAlias<Api, Alias>>,
    unknown,
    UndefinedIfNever<BodyByAlias<Api, Alias>>
  >,
  "mutationFn"
>;

export class ZodiosHooksClass<Api extends ZodiosEnpointDescriptions> {
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

  useQuery<
    Path extends Paths<Api, "get">,
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
    } as UseQueryResult<Response<Api, "get", Path>> & {
      invalidate: () => Promise<void>;
      key: QueryKey;
    };
  }

  useImmutableQuery<
    Path extends Paths<Api, "post">,
    TBody extends ReadonlyDeep<Body<Api, "post", Path>>,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "post", Path>>
  >(
    path: Path,
    body?: TBody,
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
    } as UseQueryResult<Response<Api, "post", Path>> & {
      invalidate: () => Promise<void>;
      key: QueryKey;
    };
  }

  useInfiniteQuery<
    Path extends Paths<Api, "get">,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "get", Path>>
  >(
    path: Path,
    config?: TConfig,
    queryOptions?: Omit<
      InfiniteQueryOptions<Api, Path>,
      "queryKey" | "queryFn"
    > & {
      getPageParamList: () => (
        | (QueryParams<Api, "get", Path> extends never
            ? never
            : keyof QueryParams<Api, "get", Path>)
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
    } as UseInfiniteQueryResult<Response<Api, "get", Path>> & {
      invalidate: () => Promise<void>;
      key: QueryKey;
    };
  }

  useImmutableInfiniteQuery<
    Path extends Paths<Api, "post">,
    TBody extends ReadonlyDeep<Body<Api, "post", Path>>,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "post", Path>>
  >(
    path: Path,
    body?: TBody,
    config?: TConfig,
    queryOptions?: Omit<
      ImmutableInfiniteQueryOptions<Api, "post", Path>,
      "queryKey" | "queryFn"
    > & {
      getPageParamList: () => (
        | keyof Body<Api, "post", Path>
        | PathParamNames<Path>
        | (QueryParams<Api, "post", Path> extends never
            ? never
            : keyof QueryParams<Api, "post", Path>)
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
      bodyKey = omit(body, queryOptions.getPageParamList() as (keyof TBody)[]);
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
    } as UseInfiniteQueryResult<Response<Api, "post", Path>> & {
      invalidate: () => Promise<void>;
      key: QueryKey;
    };
  }

  useMutation<
    M extends Method,
    Path extends Paths<Api, M>,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, M, Path>>
  >(
    method: M,
    path: Path,
    config?: TConfig,
    mutationOptions?: MutationOptions<Api, M, Path>
  ) {
    type MutationVariables = UndefinedIfNever<Body<Api, M, Path>>;

    const mutation: MutationFunction<
      Response<Api, M, Path>,
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
    Path extends Paths<Api, "get">,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "get", Path>>
  >(
    path: Path,
    config?: TConfig,
    queryOptions?: Omit<QueryOptions<Api, Path>, "queryKey" | "queryFn">
  ) {
    return this.useQuery(path, config, queryOptions);
  }

  usePost<
    Path extends Paths<Api, "post">,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "post", Path>>
  >(
    path: Path,
    config?: TConfig,
    mutationOptions?: MutationOptions<Api, "post", Path>
  ) {
    return this.useMutation("post", path, config, mutationOptions);
  }

  usePut<
    Path extends Paths<Api, "put">,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "put", Path>>
  >(
    path: Path,
    config?: TConfig,
    mutationOptions?: MutationOptions<Api, "put", Path>
  ) {
    return this.useMutation("put", path, config, mutationOptions);
  }

  usePatch<
    Path extends Paths<Api, "patch">,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "patch", Path>>
  >(
    path: Path,
    config?: TConfig,
    mutationOptions?: MutationOptions<Api, "patch", Path>
  ) {
    return this.useMutation("patch", path, config, mutationOptions);
  }

  useDelete<
    Path extends Paths<Api, "delete">,
    TConfig extends ReadonlyDeep<ZodiosMethodOptions<Api, "delete", Path>>
  >(
    path: Path,
    config?: TConfig,
    mutationOptions?: MutationOptions<Api, "delete", Path>
  ) {
    return this.useMutation("delete", path, config, mutationOptions);
  }
}

export type ZodiosHooksAliases<Api extends unknown[]> = MergeUnion<
  Aliases<Api> extends infer Aliases
    ? Aliases extends string
      ? {
          [Alias in `use${Capitalize<Aliases>}`]: Alias extends `use${infer AliasName}`
            ? AliasEndpointApiDescription<
                Api,
                Uncapitalize<AliasName>
              >[number]["method"] extends infer AliasMethod extends MutationMethod
              ? {
                  immutable: AliasEndpointApiDescription<
                    Api,
                    Uncapitalize<AliasName>
                  >[number]["immutable"];
                  method: AliasMethod;
                } extends { immutable: true; method: "post" }
                ? (
                    body: ReadonlyDeep<
                      BodyByAlias<Api, Uncapitalize<AliasName>>
                    >,
                    configOptions?: ZodiosConfigByAlias<
                      Api,
                      Uncapitalize<AliasName>
                    >,
                    queryOptions?: Omit<UseQueryOptions, "queryKey" | "queryFn">
                  ) => UseQueryResult<
                    ResponseByAlias<Api, Uncapitalize<AliasName>>,
                    unknown
                  > & { invalidate: () => Promise<void>; key: QueryKey }
                : (
                    configOptions?: ZodiosConfigByAlias<
                      Api,
                      Uncapitalize<AliasName>
                    >,
                    mutationOptions?: MutationOptionsByAlias<
                      Api,
                      Uncapitalize<AliasName>
                    >
                  ) => UseMutationResult<
                    ResponseByAlias<Api, Uncapitalize<AliasName>>,
                    unknown,
                    UndefinedIfNever<BodyByAlias<Api, Uncapitalize<AliasName>>>,
                    unknown
                  >
              : (
                  configOptions?: ZodiosConfigByAlias<
                    Api,
                    Uncapitalize<AliasName>
                  >,
                  queryOptions?: Omit<UseQueryOptions, "queryKey" | "queryFn">
                ) => UseQueryResult<
                  ResponseByAlias<Api, Uncapitalize<AliasName>>,
                  unknown
                > & { invalidate: () => Promise<void>; key: QueryKey }
            : never;
        }
      : never
    : never
>;

export type ZodiosHooksInstance<Api extends ZodiosEnpointDescriptions> =
  ZodiosHooksClass<Api> & ZodiosHooksAliases<Api>;

export type ZodiosHooksConstructor = {
  new <Api extends ZodiosEnpointDescriptions>(
    name: string,
    zodios: ZodiosInstance<Api>
  ): ZodiosHooksInstance<Api>;
};

export const ZodiosHooks = ZodiosHooksClass as ZodiosHooksConstructor;
