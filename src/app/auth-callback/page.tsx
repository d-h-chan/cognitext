"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "../_trpc/client";
import { Loader2 } from "lucide-react";
import React from "react";

// 'auth-callback' route, shows loading spinner and redirects based on status
const Page = () => {
  const router = useRouter();

  const searchParams = useSearchParams();

  // get the origin for redirection as a param from the url, e.g. "/auth-callback?origin=dashboard"
  const origin = searchParams.get("origin");

  const { isPending, status, error } = trpc.authCallback.useQuery(undefined, {
    retryDelay: 500,
  });

  if (isPending) {
    return (
      <div className="w-full mt-24 flex justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-800" />
          <h3 className="font-semibold text-xl">Setting up your account...</h3>
          <p>You will be redirected automatically.</p>
        </div>
      </div>
    );
  }

  if (error?.data?.code === "UNAUTHORIZED") {
    //this doesnt go anywhere yet
    router.push("/sign-in");
  }

  if (status === "success") {
    router.push(origin ? `/${origin}` : "/dashboard");
  }

  // shouldn't reach here
  return <></>;
};

export default Page;
