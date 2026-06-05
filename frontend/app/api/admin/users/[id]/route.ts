import { proxyAuthorized } from "@/lib/server-auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();

  return proxyAuthorized(`/api/admin/users/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  return proxyAuthorized(`/api/admin/users/${id}/`, {
    method: "DELETE",
  });
}
