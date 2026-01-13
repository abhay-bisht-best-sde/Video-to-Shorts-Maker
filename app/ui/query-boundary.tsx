"use client";
import { ReactNode, useMemo, useCallback } from "react";
import { UseQueryResult } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/app/ui/button";
import { Loading } from "@/app/ui/loading";
import { AnimatedEmpty } from "@/app/ui/animated-empty";
import { Spinner } from "@/app/ui/spinner";
import { AlertCircle, RefreshCw } from "lucide-react";

interface IEmptyConfig {
  title?: string;
  description?: string;
  icon?: ReactNode;
}

interface ILoadingConfig {
  message?: string;
  fullScreen?: boolean;
}

interface IErrorConfig {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

interface IQueryBoundaryProps<TData, TError> {
  query: UseQueryResult<TData, TError> | [UseQueryResult<TData, TError>, ...Array<UseQueryResult<unknown, TError>>];
  children: (data: TData) => ReactNode;
  showRefetching?: boolean;
  empty?: IEmptyConfig;
  loading?: ILoadingConfig;
  error?: IErrorConfig;
}

export function QueryBoundary<TData, TError>(props: IQueryBoundaryProps<TData, TError>): ReactNode {
  const { query, children, showRefetching = true, loading, error } = props;

  // Normalize to array
  const queries = useMemo(() => (Array.isArray(query) ? query : [query]), [query]);
  const primaryQuery = Array.isArray(query) ? query[0] : query;

  // Aggregate states from all queries
  // For loading: check if primary is loading, or if any enabled query is loading without data
  const isLoading = primaryQuery.isLoading && !primaryQuery.data;
  const isError = queries.some((q) => q.isError);
  const isRefetching = queries.some((q) => q.isRefetching);
  
  const { data } = primaryQuery;
  const queryError = queries.find((q) => q.error)?.error;
  const refetch = useCallback(() => {
    queries.forEach((q) => q.refetch());
  }, [queries]);

  const handleRetry = useCallback(() => {
    if (error?.onRetry) {
      error.onRetry();
    } else {
      refetch();
    }
  }, [error, refetch]);
  
  const errorMessage = useMemo(() => {
    if (error?.description) return error.description;
    if (queryError instanceof Error) return queryError.message;
    return "An error occurred while loading data";
  }, [error?.description, queryError]);

  if (isLoading && !data) {
    return (
      <Loading 
        message={loading?.message || "Loading..."}
        fullScreen={loading?.fullScreen}
      />
    );
  }
  if (isError) {
    return (
      <AnimatedEmpty
        title={error?.title || "Something went wrong"}
        description={errorMessage}
        icon={<AlertCircle className="size-6 text-destructive" />}
        action={
          <Button
            variant="outline"
            onClick={handleRetry}
            className="flex items-center gap-2"
          >
            <RefreshCw className="size-4" />
            Try Again
          </Button>
        }
      />
    );
  }

  if (isRefetching && showRefetching && data) {
    return (
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-md bg-background/80 px-3 py-2 text-sm text-muted-foreground backdrop-blur-sm border shadow-sm"
        >
          <Spinner className="size-4" />
          <span>Refreshing...</span>
        </motion.div>
        {data && children(data)}
      </div>
    );
  }
  return <>{data && children(data)}</>;
}
