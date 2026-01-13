export interface IEmptyConfig {
  title: string;
  description: string;
}

export interface ILoadingConfig {
  message: string;
}

export interface IErrorConfig {
  title: string;
  description: string;
  onRetry: () => void;
}
