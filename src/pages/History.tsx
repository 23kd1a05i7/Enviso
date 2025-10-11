import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Download, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default marker icons
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const History = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<any[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("location_history")
      .select("*")
      .eq("caregiver_id", user.id)
      .order("timestamp", { ascending: true });

    setLocations(data || []);
    setFilteredLocations(data || []);
    setLoading(false);
  };

  const handleFilter = () => {
    if (!startDate && !endDate) {
      setFilteredLocations(locations);
      return;
    }

    const filtered = locations.filter((loc) => {
      const locDate = new Date(loc.timestamp);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start && end) {
        return locDate >= start && locDate <= end;
      } else if (start) {
        return locDate >= start;
      } else if (end) {
        return locDate <= end;
      }
      return true;
    });

    setFilteredLocations(filtered);
  };

  const exportToCSV = () => {
    const headers = ["Timestamp", "Latitude", "Longitude", "Battery", "Speed", "Status"];
    const rows = filteredLocations.map((loc) => [
      new Date(loc.timestamp).toISOString(),
      loc.latitude,
      loc.longitude,
      loc.battery_level || "N/A",
      loc.speed || 0,
      loc.connection_status,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `location-history-${new Date().toISOString()}.csv`;
    a.click();
  };

  const checkpoints = filteredLocations.filter((loc) => loc.is_checkpoint);
  const totalDistance = filteredLocations.reduce((sum, loc) => sum + (loc.distance_traveled || 0), 0);
  const pathCoordinates: [number, number][] = filteredLocations.map((loc) => [
    loc.latitude,
    loc.longitude,
  ]);

  const defaultCenter: [number, number] = filteredLocations.length > 0
    ? [filteredLocations[0].latitude, filteredLocations[0].longitude]
    : [40.7128, -74.0060];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Location History & Checkpoints</h2>
        <Button onClick={exportToCSV} variant="outline" size="sm" disabled={filteredLocations.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filter by Date Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleFilter} className="w-full">
                Apply Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredLocations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Checkpoints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{checkpoints.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Distance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDistance.toFixed(2)} km</div>
          </CardContent>
        </Card>
      </div>

      {/* Map */}
      {filteredLocations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Route History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[500px] rounded-lg overflow-hidden">
              <MapContainer
                center={defaultCenter}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Polyline positions={pathCoordinates} color="#1e88e5" weight={3} />
                {checkpoints.map((checkpoint) => (
                  <Marker
                    key={checkpoint.id}
                    position={[checkpoint.latitude, checkpoint.longitude]}
                  >
                    <Popup>
                      <div className="p-2">
                        <p className="font-semibold">Checkpoint</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(checkpoint.timestamp).toLocaleString()}
                        </p>
                        <p className="text-xs mt-1">
                          Battery: {checkpoint.battery_level}%
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No location history found. Try adjusting your date filters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default History;
