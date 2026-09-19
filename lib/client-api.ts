export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const result = await response.json();
  if (!response.ok || !result.success)
    throw new RequestError(
      response.status >= 500
        ? "We couldn’t connect right now. Please try again shortly."
        : result.error || "Something went wrong. Please try again.",
      response.status,
    );
  return result.data as T;
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
export const money = (amount: string | number | null) =>
  amount === null
    ? "Ask for fees"
    : `₹${Number(amount).toLocaleString("en-IN")}`;
export type Center = {
  id: string;
  name: string;
  address: string;
  city: string;
  locality: string;
  subject: string;
  class_level: string;
  board: string;
  monthly_fee: string | null;
  mode: string;
  vacant_seats: number;
  average_rating: string;
  total_reviews: number;
  start_time: string;
  end_time: string;
  batch_id: string;
};
