import {
  useQuery,
  UseQueryOptions,
  useMutation,
  UseMutationOptions,
  MutationFunction,
  useQueryClient,
  UseMutationResult,
  UseQueryResult,
} from "react-query";
import { ZodiosInstance } from "@zodios/core";
import {
  AnyZodiosMethodOptions,
  Body,
  Method,
  Paths,
  Response,
  ZodiosEnpointDescriptions,
  ZodiosMethodOptions,
  ZodiosRequestOptions,
} from "@zodios/core";
import { capitalize, pick } from "./utils";
import {
  AliasEndpointApiDescription,
  Aliases,
  BodyByAlias,
  MutationMethod,
  ResponseByAlias,
  ZodiosConfigByAlias,
} from "@zodios/core/lib/zodios.types";
import { IfEquals, MergeUnion } from "@zodios/core/lib/utils.types";

type UndefinedIfNever<T> = IfEquals<T, never, undefined, T>;

type MutationOptions<
  Api extends readonly unknown[],
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

type MutationOptionsByAlias<
  Api extends readonly unknown[],
  Alias extends string
> = Omit<
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
        } else {
          (this as any)[`use${capitalize(endpoint.alias)}`] = (
            config: any,
            queryOptions: any
          ) => this.useQuery(endpoint.path as any, config, queryOptions);
        }
      }
    });
  }

  useQuery<Path extends Paths<Api, "get">>(
    path: Path,
    config?: ZodiosMethodOptions<Api, "get", Path>,
    queryOptions?: Omit<UseQueryOptions, "queryKey" | "queryFn">
  ) {
    const params = pick(config as AnyZodiosMethodOptions | undefined, [
      "params",
      "queries",
    ]);
    const keys = [this.apiName, path, params];
    const query = () => this.zodios.get(path, config);
    type QueryOptions =
      | Omit<
          UseQueryOptions<Awaited<ReturnType<typeof query>>>,
          "queryKey" | "queryFn"
        >
      | undefined;
    const queryClient = useQueryClient();
    const invalidate = () => queryClient.invalidateQueries(keys);
    return {
      invalidate,
      ...useQuery(keys, query, queryOptions as QueryOptions),
    };
  }

  useMutation<M extends Method, Path extends Paths<Api, M>>(
    method: M,
    path: Path,
    config?: ZodiosMethodOptions<Api, M, Path>,
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

  useGet<Path extends Paths<Api, "get">>(
    path: Path,
    config?: ZodiosMethodOptions<Api, "get", Path>,
    queryOptions?: Omit<UseQueryOptions, "queryKey" | "queryFn">
  ) {
    return this.useQuery(path, config, queryOptions);
  }

  usePost<Path extends Paths<Api, "post">>(
    path: Path,
    config?: ZodiosMethodOptions<Api, "post", Path>,
    mutationOptions?: MutationOptions<Api, "post", Path>
  ) {
    return this.useMutation("post", path, config, mutationOptions);
  }

  usePut<Path extends Paths<Api, "put">>(
    path: Path,
    config?: ZodiosMethodOptions<Api, "put", Path>,
    mutationOptions?: MutationOptions<Api, "put", Path>
  ) {
    return this.useMutation("put", path, config, mutationOptions);
  }

  usePatch<Path extends Paths<Api, "patch">>(
    path: Path,
    config?: ZodiosMethodOptions<Api, "patch", Path>,
    mutationOptions?: MutationOptions<Api, "patch", Path>
  ) {
    return this.useMutation("patch", path, config, mutationOptions);
  }

  useDelete<Path extends Paths<Api, "delete">>(
    path: Path,
    config?: ZodiosMethodOptions<Api, "delete", Path>,
    mutationOptions?: MutationOptions<Api, "delete", Path>
  ) {
    return this.useMutation("delete", path, config, mutationOptions);
  }
}

export type ZodiosHooksAliases<Api extends readonly unknown[]> = MergeUnion<
  Aliases<Api> extends infer Aliases
    ? Aliases extends string
      ? {
          [Alias in `use${Capitalize<Aliases>}`]: Alias extends `use${infer AliasName}`
            ? AliasEndpointApiDescription<
                Api,
                Uncapitalize<AliasName>
              >[number]["method"] extends MutationMethod
              ? (
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
                  UndefinedIfNever<BodyByAlias<Api, Alias>>,
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
                >
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
