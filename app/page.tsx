import { getCategoryOptions } from "@/lib/questions.server";
import Interview from "./interview";

export default function Home() {
  // Server component: reads the question bank and passes only ids and labels.
  return <Interview categories={getCategoryOptions()} />;
}
