import type { Metadata } from "next";
import ModelPage from "./ModelPage";

export const metadata: Metadata = { title: "Your model" };

export default function Page() {
  return <ModelPage />;
}
