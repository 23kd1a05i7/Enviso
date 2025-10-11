import { GoogleMap, Marker as GoogleMarker, Circle as GoogleCircle, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { RefreshCw, Navigation } from "lucide-react";

const LiveTracking = () => {
  // Removed duplicate selectedZone declaration
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "YOUR_GOOGLE_MAPS_API_KEY";
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });
  interface Location {
    latitude: number;
    longitude: number;
    timestamp: string;
    battery_level?: number;
    speed?: number;
    accuracy?: number;
    connection_status?: string;
  }

  interface SafeZone {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
    alert_on_entry: boolean;
    alert_on_exit: boolean;
  }

  const [selectedZone, setSelectedZone] = useState<SafeZone | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load latest location
    const { data: locationData } = await supabase
      .from("location_history")
      .select("*")
      .eq("caregiver_id", user.id)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    setCurrentLocation(locationData);

    // Load safe zones
    const { data: zonesData } = await supabase
      .from("safe_zones")
      .select("*")
      .eq("caregiver_id", user.id);

    setSafeZones(zonesData || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    // Set up real-time subscription
    const channel = supabase
      .channel("live_location")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "location_history",
        },
        (payload) => {
           // Ensure payload.new matches Location type
           if (
             payload.new &&
             typeof payload.new.latitude === "number" &&
             typeof payload.new.longitude === "number" &&
             typeof payload.new.timestamp === "string"
           ) {
             setCurrentLocation({
               latitude: payload.new.latitude,
               longitude: payload.new.longitude,
               timestamp: payload.new.timestamp,
               battery_level: payload.new.battery_level,
               speed: payload.new.speed,
               accuracy: payload.new.accuracy,
               connection_status: ["online", "offline", "low_battery"].includes(payload.new.connection_status)
                 ? payload.new.connection_status
                 : "offline",
             });
           }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const defaultCenter: [number, number] = currentLocation
    ? [currentLocation.latitude, currentLocation.longitude]
    : [40.7128, -74.0060]; // Default to New York

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p>Loading Google Maps...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Live Location Tracking</h2>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Status Card */}
      {currentLocation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Current Status</span>
              <StatusBadge status={
                ["online", "offline", "low_battery"].includes(currentLocation.connection_status ?? "")
                  ? currentLocation.connection_status as "online" | "offline" | "low_battery"
                  : "offline"
              } />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Battery</p>
                <p className="font-medium">{currentLocation.battery_level || "N/A"}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Speed</p>
                <p className="font-medium">{currentLocation.speed?.toFixed(1) || "0"} km/h</p>
              </div>
              <div>
                <p className="text-muted-foreground">Accuracy</p>
                <p className="font-medium">{currentLocation.accuracy?.toFixed(0) || "N/A"}m</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Update</p>
                <p className="font-medium">
                  {new Date(currentLocation.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Google Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Live Map View
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[500px] rounded-lg overflow-hidden">
            <GoogleMap
              center={{ lat: defaultCenter[0], lng: defaultCenter[1] }}
              zoom={13}
              mapContainerStyle={{ height: "100%", width: "100%" }}
            >
              {currentLocation && (
                <GoogleMarker position={{ lat: currentLocation.latitude, lng: currentLocation.longitude }}>
                  <InfoWindow>
                    <div className="p-2">
                      <p className="font-semibold">Current Location</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(currentLocation.timestamp).toLocaleString()}
                      </p>
                      <p className="text-xs mt-1">
                        Battery: {currentLocation.battery_level}%
                      </p>
                    </div>
                  </InfoWindow>
                </GoogleMarker>
              )}
              {safeZones.map((zone) => (
                <>
                  <GoogleCircle
                    key={zone.id}
                    center={{ lat: zone.latitude, lng: zone.longitude }}
                    radius={zone.radius}
                    options={{
                      strokeColor: zone.alert_on_exit ? "#ef4444" : "#22c55e",
                      fillColor: zone.alert_on_exit ? "#ef4444" : "#22c55e",
                      fillOpacity: 0.2,
                    }}
                  />
                  <GoogleMarker
                    position={{ lat: zone.latitude, lng: zone.longitude }}
                    onClick={() => setSelectedZone(zone)}
                  />
                  {selectedZone && selectedZone.id === zone.id && (
                    <InfoWindow
                      position={{ lat: zone.latitude, lng: zone.longitude }}
                      onCloseClick={() => setSelectedZone(null)}
                    >
                      <div className="p-2">
                        <p className="font-semibold">{zone.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Radius: {zone.radius}m
                        </p>
                      </div>
                    </InfoWindow>
                  )}
                </>
              ))}
            </GoogleMap>
          </div>
        </CardContent>
      </Card>

      {!currentLocation && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No location data available yet. Waiting for first update...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LiveTracking;
