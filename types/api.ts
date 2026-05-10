// API related types
export interface ApiResponse<T> {
  data: T;
  error?: string;
  status: number;
}
