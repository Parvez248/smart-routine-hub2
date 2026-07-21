import type { Metadata } from "next";
import RoleLoginForm from "../RoleLoginForm";

export const metadata: Metadata = { title: "Teacher Sign In" };

export default function TeacherLoginPage() {
  return (
    <RoleLoginForm
      role="TEACHER"
      heading="Teacher Login"
      description="Sign in with your teacher account."
      signup={{ href: "/register/teacher", label: "Create an account" }}
    />
  );
}
