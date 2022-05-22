import React from "react";
import { renderHook } from "@testing-library/react-hooks";
import { Zodios, ApiOf, ZodiosInstance } from "@zodios/core";
import { ZodiosHooks } from "./hooks";
import express from "express";
import { AddressInfo } from "net";
import z from "zod";
import cors from "cors";
import { QueryClient, QueryClientProvider } from "react-query";

const api = [
  {
    method: "get",
    path: "/:id",
    response: z.object({
      id: z.number(),
      name: z.string(),
    }),
  },
  {
    method: "get",
    path: "/:id/address/:address",
    response: z.object({
      id: z.number(),
      address: z.string(),
    }),
  },
  {
    method: "post",
    path: "/",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({
          name: z.string(),
        }),
      },
    ],
    response: z.object({
      id: z.number(),
      name: z.string(),
    }),
  },
  {
    method: "put",
    path: "/",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({
          id: z.number(),
          name: z.string(),
        }),
      },
    ],
    response: z.object({
      id: z.number(),
      name: z.string(),
    }),
  },
  {
    method: "patch",
    path: "/",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: z.object({
          id: z.number(),
          name: z.string(),
        }),
      },
    ],
    response: z.object({
      id: z.number(),
      name: z.string(),
    }),
  },
  {
    method: "delete",
    path: "/:id",
    response: z.object({
      id: z.number(),
    }),
  },
] as const;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe("zodios hooks", () => {
  let app: express.Express;
  let server: ReturnType<typeof app.listen>;
  let port: number;
  let apiClient: ZodiosInstance<typeof api>;
  let apiHooks: ZodiosHooks<typeof api>;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cors());
    app.get("/error502", (req, res) => {
      res.status(502).json({ error: { message: "bad gateway" } });
    });
    app.get("/:id", (req, res) => {
      res.status(200).json({ id: Number(req.params.id), name: "test" });
    });
    app.get("/:id/address/:address", (req, res) => {
      res
        .status(200)
        .json({ id: Number(req.params.id), address: req.params.address });
    });
    app.post("/", (req, res) => {
      res.status(200).json({ id: 3, name: req.body.name });
    });
    app.put("/", (req, res) => {
      res.status(200).json({ id: req.body.id, name: req.body.name });
    });
    app.patch("/", (req, res) => {
      res.status(200).json({ id: req.body.id, name: req.body.name });
    });
    app.delete("/:id", (req, res) => {
      res.status(200).json({ id: Number(req.params.id) });
    });

    server = app.listen(0);
    port = (server.address() as AddressInfo).port;

    apiClient = new Zodios(`http://localhost:${port}`, api);

    apiHooks = new ZodiosHooks("test", apiClient);
  });

  afterAll(() => {
    server.close();
  });

  it("should get id", async () => {
    const { result, waitFor } = renderHook(
      () => apiHooks.useGet("/:id", { params: { id: 1 } }),
      { wrapper }
    );
    await waitFor(() => result.current.isSuccess);
    expect(result.current.data).toEqual({
      id: 1,
      name: "test",
    });
  });

  it("should get id and address", async () => {
    const { result, waitFor } = renderHook(
      () =>
        apiHooks.useGet("/:id/address/:address", {
          params: { id: 1, address: "test" },
        }),
      { wrapper }
    );
    await waitFor(() => result.current.isSuccess);
    expect(result.current.data).toEqual({
      id: 1,
      address: "test",
    });
  });

  it("should create user", async () => {
    const { result, waitFor } = renderHook(
      () => {
        const [userCreated, setUserCreated] = React.useState<{
          id: number;
          name: string;
        }>();
        const apiMutations = apiHooks.usePost("/", undefined, {
          onSuccess: (data) => {
            setUserCreated(data);
          },
        });
        return { apiMutations, userCreated };
      },
      { wrapper }
    );
    result.current.apiMutations.mutate({ name: "test" });
    await waitFor(() => result.current.apiMutations.isSuccess);
    expect(result.current.userCreated).toEqual({ id: 3, name: "test" });
  });

  it("should update user", async () => {
    const { result, waitFor } = renderHook(
      () => {
        const [userUpdated, setUserUpdated] = React.useState<{
          id: number;
          name: string;
        }>();
        const apiMutations = apiHooks.usePut("/", undefined, {
          onSuccess: (data) => {
            setUserUpdated(data);
          },
        });
        return { apiMutations, userUpdated };
      },
      { wrapper }
    );
    result.current.apiMutations.mutate({ id: 1, name: "test" });
    await waitFor(() => result.current.apiMutations.isSuccess);
    expect(result.current.userUpdated).toEqual({ id: 1, name: "test" });
  });

  it("should patch user", async () => {
    const { result, waitFor } = renderHook(
      () => {
        const [userPatched, setUserPatched] = React.useState<{
          id: number;
          name: string;
        }>();
        const apiMutations = apiHooks.usePatch("/", undefined, {
          onSuccess: (data) => {
            setUserPatched(data);
          },
        });
        return { apiMutations, userPatched };
      },
      { wrapper }
    );
    result.current.apiMutations.mutate({ id: 2, name: "test" });
    await waitFor(() => result.current.apiMutations.isSuccess);
    expect(result.current.userPatched).toEqual({ id: 2, name: "test" });
  });

  it("should delete user", async () => {
    const { result, waitFor } = renderHook(
      () => {
        const [userDeleted, setUserDeleted] = React.useState<{
          id: number;
        }>();
        const apiMutations = apiHooks.useDelete(
          "/:id",
          { params: { id: 3 } },
          {
            onSuccess: (data) => {
              setUserDeleted(data);
            },
          }
        );
        return { apiMutations, userDeleted };
      },
      { wrapper }
    );
    result.current.apiMutations.mutate(undefined);
    await waitFor(() => result.current.apiMutations.isSuccess);
    expect(result.current.userDeleted).toEqual({ id: 3 });
  });
});
