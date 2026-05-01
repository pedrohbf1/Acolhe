import type { Routes } from "../type";
import LoginAuthPage from "@/pages/auth/login";
import RegisterAuthPage from "@/pages/auth/register";
import ForgotPasswordPage from "@/pages/auth/forgot-password";
import ResetPasswordPage from "@/pages/auth/reset-password";
import VerifyEmailSentPage from "@/pages/auth/verify-email-sent";
import AcceptInvitationPage from "@/pages/auth/accept-invitation";

export const routesAuth: Routes[] = [
  { path: "/", element: <LoginAuthPage /> },
  { path: "/register", element: <RegisterAuthPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/verify-email-sent", element: <VerifyEmailSentPage /> },
  { path: "/accept-invitation/:id", element: <AcceptInvitationPage /> },
];
