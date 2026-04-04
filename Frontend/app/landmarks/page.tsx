import { redirect } from "next/navigation"

export default function LandmarksPage() {
  redirect("/entidades?section=landmarks")
}
