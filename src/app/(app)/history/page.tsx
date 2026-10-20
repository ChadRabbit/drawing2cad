import type { Metadata } from "next";
import History from "./History";
import "./history.css";

export const metadata: Metadata = { title: "Your models" };

export default function Page() {
  return <History />;
}
