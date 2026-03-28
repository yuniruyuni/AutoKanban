import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { createTRPCClient, trpc } from "./trpc";

function App() {
	const [queryClient] = useState(() => new QueryClient());
	const [trpcClient] = useState(() => createTRPCClient());

	return (
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>
		</trpc.Provider>
	);
}

export default App;
