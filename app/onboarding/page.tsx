import { redirect } from "next/navigation";

// Onboarding is retired. Its pitch moved to the landing page, bio moved to the
// signup form, and new members now go straight into the app, where the guided
// tour runs (contexts/TourContext.tsx). Old links land on home.
export default function OnboardingPage() {
  redirect("/home");
}
