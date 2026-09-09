import { Layout } from "./components/layout.tsx";
import { ActivityHeading, ActivityOverview, ConnectionNotice, LogSource } from "./features/activity-overview.tsx";
import { CallExplorer } from "./features/call-explorer.tsx";
import { CallInspector } from "./features/call-inspector.tsx";

export function App() {
  return (
    <>
      <Layout>
        <ActivityHeading />
        <ConnectionNotice />
        <ActivityOverview />
        <CallExplorer />
        <LogSource />
      </Layout>
      <CallInspector />
    </>
  );
}
