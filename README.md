 <h1 align="center">Zodios React</h1>
 <p align="center">
   <a href="https://github.com/ecyrbe/zodios-react">
     <img align="center" src="https://raw.githubusercontent.com/ecyrbe/zodios-react/main/docs/logo.svg" width="128px" alt="Zodios logo">
   </a>
 </p>
 
 <p align="center">
    React hooks for zodios backed by <a src="https://react-query.tanstack.com/" >react-query</a>
 </p>
 
 <p align="center">
   <a href="https://www.npmjs.com/package/@zodios/react">
   <img src="https://img.shields.io/npm/v/@zodios/react.svg" alt="langue typescript">
   </a>
   <a href="https://www.npmjs.com/package/@zodios/react">
   <img alt="npm" src="https://img.shields.io/npm/dw/@zodios/react">
   </a>
   <a href="https://github.com/ecyrbe/zodios-react/blob/main/LICENSE">
    <img alt="GitHub" src="https://img.shields.io/github/license/ecyrbe/zodios-react">   
   </a>
   <img alt="GitHub Workflow Status" src="https://img.shields.io/github/workflow/status/ecyrbe/zodios-react/CI">
 </p>

# Install

```bash
> npm install @zodios/react
```

or

```bash
> yarn add @zodios/react
```

# Usage

Zodios comes with a Query and Mutation hook helper.  
It's a thin wrapper around React-Query but with zodios auto completion.
  
Zodios query hook also returns an invalidation helper to allow you to reset react query cache easily
  
```typescript
import { QueryClient, QueryClientProvider } from 'react-query';
import { Zodios } from "@zodios/core";
import { ZodiosHooks } from "@zodios/react";
import { z } from "zod";

const userSchema = z
  .object({
    id: z.number(),
    name: z.string(),
  });
const usersSchema = z.array(userSchema);

type User = z.infer<typeof userSchema>;
type Users = z.infer<typeof usersSchema>;

const api = [
  {
    method: "get",
    path: "/users",
    description: "Get all users",
    response: usersSchema,
  },
  {
    method: "post",
    path: "/users",
    description: "Create a user",
    parameters: [
      {
        name: "body",
        type: "Body",
        schema: userSchema,
      },
    ],
    response: userSchema,
  },
] as const;
const baseUrl = "https://jsonplaceholder.typicode.com";

const zodios = new Zodios(baseUrl, api);
const zodiosHooks = new ZodiosHooks("jsonplaceholder", zodios);

const Users = () => {
  const {
    data: users,
    isLoading,
    error,
    invalidate: invalidateUsers,
  } = zodiosHooks.useQuery("/users");
  const { mutate } = zodiosHooks.useMutation("post", "/users", {
    onSuccess: () => invalidateUsers(), // zodios also provides invalidation helpers
  });

  return (
    <div>
      <h1>Users</h1>
      <button onClick={() => mutate({ data: { id: 10, name: "john doe" } })}>
        add user
      </button>
      {isLoading && <div>Loading...</div>}
      {error && <div>Error: {(error as Error).message}</div>}
      {users && (
        <ul>
          {users.map((user) => (
            <li key={user.id}>{user.name}</li>
          ))}
        </ul>
      )}
    </div>
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
```
