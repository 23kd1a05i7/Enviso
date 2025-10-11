import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Clock, Activity, Battery } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

const Dashboard = () => {
  const [profile, setProfile] = useState<any>(null);
  const [latestLocation, setLatestLocation] = useState<any>(null);
  const [stats, setStats] = useState({
    totalLocations: 0,
    checkpoints: 0,
  });

  useEffect(() => {
    const loadDashboardData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(profileData);

      // Load latest location
      const { data: locationData } = await supabase
        .from("location_history")
        .select("*")
        .eq("caregiver_id", user.id)
        .order("timestamp", { ascending: false })
        .limit(1)
        .single();

      setLatestLocation(locationData);

      // Load stats
      const { count: totalCount } = await supabase
        .from("location_history")
        .select("*", { count: "exact", head: true })
        .eq("caregiver_id", user.id);

      const { count: checkpointCount } = await supabase
        .from("location_history")
        .select("*", { count: "exact", head: true })
        .eq("caregiver_id", user.id)
        .eq("is_checkpoint", true);

      setStats({
        totalLocations: totalCount || 0,
        checkpoints: checkpointCount || 0,
      });
    };

    loadDashboardData();

    // Set up real-time subscription
    const channel = supabase
      .channel("location_updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "location_history",
        },
        (payload) => {
          setLatestLocation(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-2">
          Welcome back!
        </h2>
        <p className="text-muted-foreground">
          Monitoring {profile?.blind_user_name || "your loved one"}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {latestLocation ? (
              <StatusBadge status={latestLocation.connection_status} />
            ) : (
              <p className="text-sm text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Known Location</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {latestLocation ? (
              <div className="text-sm">
                <p className="font-medium">
                  {latestLocation.latitude.toFixed(6)}, {latestLocation.longitude.toFixed(6)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(latestLocation.timestamp).toLocaleString()}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No location data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Battery Level</CardTitle>
            <Battery className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {latestLocation && latestLocation.battery_level ? (
              <div className="text-2xl font-bold">
                {latestLocation.battery_level}%
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Checkpoints</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.checkpoints}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalLocations} total locations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Device ID:</span>
              <span className="text-sm font-medium">{profile?.blind_user_device_id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Relationship:</span>
              <span className="text-sm font-medium">{profile?.relationship || "Not specified"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
