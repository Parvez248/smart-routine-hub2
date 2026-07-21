import type { Metadata } from "next";
import RoleLoginForm from "../RoleLoginForm";

export const metadata: Metadata = { title: "Admin Sign In" };

export default function AdminLoginPage() {
  return (
    <RoleLoginForm
      role="ADMIN"
      heading="Administration Login"
      description="Sign in with your administrator account."
      note="Administrator accounts are created by the department."
    />
  );
}
