import React from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { asApi, Zodios } from "@zodios/core";
import { ZodiosHooks } from "../src";
import { z } from "zod";

// you can define schema before declaring the API to get back the type
const userSchema = z
  .object({
    id: z.number(),
    name: z.string(),
  })
  .required();

const createUserSchema = z
  .object({
    name: z.string(),
  })
  .required();

const usersSchema = z.array(userSchema);

// you can then get back the types
type User = z.infer<typeof userSchema>;
type Users = z.infer<typeof usersSchema>;

const api = asApi([
  {
    method: "get",
    path: "/users",
    alias: "getUsers",
    description: "Get all users",
    parameters: [
      {
        name: "q",
        type: "Query",
        schema: z.string(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: usersSchema,
  },
  {
    method: "get",
    path: "/users/:id",
    description: "Get a user",
    response: userSchema,
  },
  {
    method: "post",
    path: "/users",
    description: "Create a user",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: createUserSchema,
      },
    ],
    response: userSchema,
  },
]);
const baseUrl = "https://jsonplaceholder.typicode.com";

const zodios = new Zodios(baseUrl, api);
const zodiosHooks = new ZodiosHooks("jsonplaceholder", zodios);

const Users = () => {
  const {
    data: users,
    isLoading,
    error,
    invalidate: invalidateUsers, // zodios also provides invalidation helpers
  } = zodiosHooks.useGetUsers();
  const { mutate } = zodiosHooks.useMutation("post", "/users", undefined, {
    onSuccess: () => invalidateUsers(),
  });

  return (
    <>
      <h1>Users</h1>
      <button onClick={() => mutate({ name: "john doe" })}>add user</button>
      {isLoading && <div>Loading...</div>}
      {error && <div>Error: {(error as Error).message}</div>}
      {users && (
        <ul>
          {users.map((user) => (
            <li key={user.id}>{user.name}</li>
          ))}
        </ul>
      )}
    </>
  );
};

// on another file
const queryClient = new QueryClient();

export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Users />
    </QueryClientProvider>
  );
};
