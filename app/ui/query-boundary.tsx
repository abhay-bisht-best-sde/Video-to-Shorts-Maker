"use client";

import { ReactNode, useMemo, useCallback } from "react";
import { UseQueryResult } from "@tanstack/react-query";
import { Button } from "@/app/ui/button";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/app/ui/empty";
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
  query: UseQueryResult<TData, TError>;
  children: (data: TData) => ReactNode;
  showRefetching?: boolean;
  empty?: IEmptyConfig;
  loading?: ILoadingConfig;
  error?: IErrorConfig;
}

export function QueryBoundary<TData, TError>(props: IQueryBoundaryProps<TData, TError>) {
  const { query, children, showRefetching = true, empty, loading, error } = props;

  const { data, isLoading, isError, error: queryError, isRefetching, refetch } = query;
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

  const isEmpty = useMemo(() => {
    return data === null || data === undefined || (Array.isArray(data) && data.length === 0);
  }, [data]);
  
  if (isLoading && !data) {
    return (
      <div className={loading?.fullScreen ? "flex min-h-screen items-center justify-center" : "flex items-center justify-center py-12"}>
        <div className="flex flex-col items-center gap-4">
          <Spinner className="size-8" />
          <p className="text-sm text-muted-foreground">
            {loading?.message || "Loading..."}
          </p>
        </div>
      </div>
    );
  }
  if (isError) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <AlertCircle className="size-6 text-destructive" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>
            {error?.title || "Something went wrong"}
          </EmptyTitle>
          <EmptyDescription>
            {errorMessage}
          </EmptyDescription>
        </EmptyHeader>
        <Button
          variant="outline"
          onClick={handleRetry}
          className="flex items-center gap-2"
        >
          <RefreshCw className="size-4" />
          Try Again
        </Button>
      </Empty>
    );
  }
  if (isEmpty) {
    return (
      <Empty>
        {empty?.icon && (
          <EmptyMedia variant="icon">
            {empty.icon}
          </EmptyMedia>
        )}
        <EmptyHeader>
          <EmptyTitle>
            {empty?.title || "No data found"}
          </EmptyTitle>
          {empty?.description && (
            <EmptyDescription>
              {empty.description}
            </EmptyDescription>
          )}
        </EmptyHeader>
      </Empty>
    );
  }
  if (isRefetching && showRefetching && data) {
    return (
      <div className="relative">
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-md bg-background/80 px-3 py-2 text-sm text-muted-foreground backdrop-blur-sm">
          <Spinner className="size-4" />
          <span>Refreshing...</span>
        </div>
        {data && children(data)}
      </div>
    );
  }
  return <>{data && children(data)}</>;
}
