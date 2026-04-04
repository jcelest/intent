/**
 * In-memory store for form submissions (not written to disk).
 * On serverless hosts (e.g. Vercel), each function instance has its own memory and
 * instances restart or scale — submissions are not durable and can disappear at any time.
 * For persistent history, use a database (e.g. Vercel Postgres, Supabase).
 */

export type FormSubmission = {
  id: string;
  name: string;
  email: string;
  phone: string;
  trade?: string;
  message?: string;
  source?: string;
  createdAt: string;
};

const submissions: FormSubmission[] = [];

export function addSubmission(data: Omit<FormSubmission, "id" | "createdAt">): FormSubmission {
  const submission: FormSubmission = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  submissions.push(submission);
  return submission;
}

export function getSubmissions(): FormSubmission[] {
  return [...submissions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
