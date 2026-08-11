import Dashboard from "./dashboard";
import { demoData } from "../lib/demo-data";

export const dynamic = "force-dynamic";

export default function Home() {
  return <Dashboard initialData={demoData} />;
}

