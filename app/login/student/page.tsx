import RoleLoginForm from "../RoleLoginForm";

export default function StudentLoginPage() {
  return (
    <RoleLoginForm
      role="STUDENT"
      heading="Student Login"
      description="Sign in with your student account."
      signup={{ href: "/register/student", label: "Create an account" }}
    />
  );
}
