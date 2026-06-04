import { createFileRoute } from "@tanstack/react-router";
import { AssignSuperAdmin } from "@/components/admin/assign-super-admin";

export const Route = createFileRoute("/assign-super-admin")({
  component: AssignSuperAdminPage,
});

function AssignSuperAdminPage() {
  return <AssignSuperAdmin />;
}
