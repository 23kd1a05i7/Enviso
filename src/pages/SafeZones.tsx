import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";
import { GoogleMap, Marker as GoogleMarker, Circle as GoogleCircle, useJsApiLoader, InfoWindow } from '@react-google-maps/api';

interface SafeZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  alert_on_entry: boolean;
  alert_on_exit: boolean;
}


const SafeZones = () => {
  const [selectedZone, setSelectedZone] = useState<SafeZone | null>(null);
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "YOUR_GOOGLE_MAPS_API_KEY";
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    latitude: 0,
    longitude: 0,
    radius: 100,
    alert_on_entry: false,
    alert_on_exit: true,
  });

  useEffect(() => {
    loadSafeZones();
  }, []);

  const loadSafeZones = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("safe_zones")
      .select("*")
      .eq("caregiver_id", user.id);

    setSafeZones(data || []);
    setLoading(false);
  };

  const handleMapClick = (lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
    toast.success("Location selected on map");
  };

  const handleCreate = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (!formData.name || formData.latitude === 0 || formData.longitude === 0) {
      toast.error("Please fill all required fields");
      return;
    }

    const { error } = await supabase.from("safe_zones").insert({
      caregiver_id: user.id,
      name: formData.name,
      latitude: formData.latitude,
      longitude: formData.longitude,
      radius: formData.radius,
      alert_on_entry: formData.alert_on_entry,
      alert_on_exit: formData.alert_on_exit,
    });

    if (error) {
      toast.error("Failed to create safe zone");
      return;
    }

    toast.success("Safe zone created successfully");
    setDialogOpen(false);
    setFormData({
      name: "",
      latitude: 0,
      longitude: 0,
      radius: 100,
      alert_on_entry: false,
      alert_on_exit: true,
    });
    loadSafeZones();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("safe_zones").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete safe zone");
      return;
    }

    toast.success("Safe zone deleted");
    loadSafeZones();
  };

  const defaultCenter: [number, number] = safeZones.length > 0
    ? [safeZones[0].latitude, safeZones[0].longitude]
    : [40.7128, -74.0060];

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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Safe Zones Management</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Safe Zone
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Safe Zone</DialogTitle>
              <DialogDescription>
                Click on the map to set the location, then configure the safe zone settings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="h-[300px] rounded-lg overflow-hidden">
                <GoogleMap
                  center={{ lat: formData.latitude || defaultCenter[0], lng: formData.longitude || defaultCenter[1] }}
                  zoom={13}
                  mapContainerStyle={{ height: "100%", width: "100%" }}
                  onClick={(e) => {
                    const lat = e.latLng?.lat();
                    const lng = e.latLng?.lng();
                    if (lat && lng) handleMapClick(lat, lng);
                  }}
                >
                  {formData.latitude !== 0 && formData.longitude !== 0 && (
                    <>
                      <GoogleMarker position={{ lat: formData.latitude, lng: formData.longitude }} />
                      <GoogleCircle
                        center={{ lat: formData.latitude, lng: formData.longitude }}
                        radius={formData.radius}
                        options={{ strokeColor: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.2 }}
                      />
                    </>
                  )}
                </GoogleMap>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zone-name">Zone Name</Label>
                <Input
                  id="zone-name"
                  placeholder="e.g., Home, School, Park"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="radius">Radius (meters)</Label>
                <Input
                  id="radius"
                  type="number"
                  min="50"
                  max="5000"
                  value={formData.radius}
                  onChange={(e) =>
                    setFormData({ ...formData, radius: parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="alert-entry">Alert on Entry</Label>
                <Switch
                  id="alert-entry"
                  checked={formData.alert_on_entry}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, alert_on_entry: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="alert-exit">Alert on Exit</Label>
                <Switch
                  id="alert-exit"
                  checked={formData.alert_on_exit}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, alert_on_exit: checked })
                  }
                />
              </div>

              <Button onClick={handleCreate} className="w-full">
                Create Safe Zone
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Map View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Safe Zones Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[500px] rounded-lg overflow-hidden">
            <GoogleMap
              center={{ lat: defaultCenter[0], lng: defaultCenter[1] }}
              zoom={13}
              mapContainerStyle={{ height: "100%", width: "100%" }}
            >
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
                        <p className="text-xs text-muted-foreground">Radius: {zone.radius}m</p>
                      </div>
                    </InfoWindow>
                  )}
                </>
              ))}
            </GoogleMap>
          </div>
        </CardContent>
      </Card>

      {/* Safe Zones List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {safeZones.map((zone) => (
          <Card key={zone.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{zone.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(zone.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Radius:</span>
                  <span className="font-medium">{zone.radius}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alert on Entry:</span>
                  <span className="font-medium">{zone.alert_on_entry ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alert on Exit:</span>
                  <span className="font-medium">{zone.alert_on_exit ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Coordinates:</span>
                  <span className="font-medium text-xs">
                    {zone.latitude.toFixed(4)}, {zone.longitude.toFixed(4)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {safeZones.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No safe zones created yet. Click "Create Safe Zone" to add one.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SafeZones;
