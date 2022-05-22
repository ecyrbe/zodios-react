import {
  useQuery,
  UseQueryOptions,
  useMutation,
  UseMutationOptions,
  MutationFunction,
  useQueryClient,
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
import { pick } from "./utils";

export type IfEquals<T, U, Y = unknown, N = never> = (<G>() => G extends T
  ? 1
  : 2) extends <G>() => G extends U ? 1 : 2
  ? Y
  : N;

type UndefinedIfNever<T> = IfEquals<T, never, undefined, T>;

type MutationOptions<
  Api extends ZodiosEnpointDescriptions,
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

export class ZodiosHooks<Api extends ZodiosEnpointDescriptions> {
  constructor(
    private readonly apiName: string,
    private readonly zodios: ZodiosInstance<Api>
  ) {}

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
