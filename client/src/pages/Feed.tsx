import AppLayout from "@/components/layout/AppLayout";
import TelemetryTable from "@/components/dashboard/TelemetryTable";

export default function Feed() {
  return (
    <AppLayout>
      <div className="max-w-[1600px] mx-auto h-[calc(100vh-8rem)]">
        <TelemetryTable limit={50} />
      </div>
    </AppLayout>
  );
}
