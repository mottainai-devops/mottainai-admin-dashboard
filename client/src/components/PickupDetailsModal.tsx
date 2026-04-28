import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, Package, MapPin, Calendar, CreditCard, User, Camera } from "lucide-react";
import { useState } from "react";

interface PickupDetailsModalProps {
  pickupId: string | null;
  open: boolean;
  onClose: () => void;
}

export function PickupDetailsModal({ pickupId, open, onClose }: PickupDetailsModalProps) {
  const { data: pickup, isLoading } = trpc.pickups.getById.useQuery(
    { id: pickupId! },
    { enabled: !!pickupId && open }
  );

  const [photoError, setPhotoError] = useState<Record<string, boolean>>({});

  const p = pickup as any;

  // Platform backend base URL for resolving relative /uploads/ photo paths
  const PLATFORM_BASE = 'https://upwork.kowope.xyz';

  // Resolve the best available photo URL for display
  const resolvePhotoUrl = (urlField: string | null | undefined, pathField: string | null | undefined): string | null => {
    // Full S3 URL
    if (urlField && urlField.startsWith('http')) return urlField;
    // Relative path saved as fallback when S3 upload fails — serve from platform backend
    if (urlField && urlField.startsWith('/')) return `${PLATFORM_BASE}${urlField}`;
    if (pathField && pathField.startsWith('http')) return pathField;
    if (pathField && pathField.startsWith('/')) return `${PLATFORM_BASE}${pathField}`;
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pickup Details
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !pickup ? (
          <p className="text-center text-muted-foreground py-8">Pickup not found.</p>
        ) : (
          <div className="space-y-4 text-sm">
            {/* Building & Location */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                <MapPin className="h-3.5 w-3.5" /> Location
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Customer ID</span><p className="font-mono font-medium">{p.buildingId || "—"}</p></div>
                <div><span className="text-muted-foreground">Lot Code</span><p className="font-mono">{p.lotCode || "—"}</p></div>
                <div><span className="text-muted-foreground">LGA</span><p>{p.lgaName || "—"}</p></div>
                <div><span className="text-muted-foreground">Ward</span><p>{p.wardName || "—"}</p></div>
                <div><span className="text-muted-foreground">State Code</span><p>{p.stateCode || "—"}</p></div>
                <div><span className="text-muted-foreground">Country</span><p>{p.country || "—"}</p></div>
              </div>
            </div>

            {/* Customer */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                <User className="h-3.5 w-3.5" /> Customer
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Name</span><p>{p.fullName || "—"}</p></div>
                <div><span className="text-muted-foreground">Phone</span><p>{p.phoneNumber || "—"}</p></div>
                <div><span className="text-muted-foreground">Email</span><p className="break-all">{p.customerEmail || "—"}</p></div>
                <div><span className="text-muted-foreground">Address</span><p>{p.customerAddress || "—"}</p></div>
                <div><span className="text-muted-foreground">Type</span><p className="capitalize">{p.customerType || "—"}</p></div>
                <div><span className="text-muted-foreground">Bin Type</span><p>{p.binType || "—"}</p></div>
              </div>
            </div>

            {/* Billing */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                <CreditCard className="h-3.5 w-3.5" /> Billing
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Amount</span><p className="font-semibold">₦{(p.totalDue || p.amount || 0).toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Bin Qty</span><p>{p.binQtyPerPickup || p.quantity || 1}</p></div>
                <div><span className="text-muted-foreground">Payment Type</span>
                  <Badge variant={p.paymentType === "monthly" ? "default" : "secondary"} className="mt-0.5">
                    {p.paymentType || "—"}
                  </Badge>
                </div>
                <div><span className="text-muted-foreground">Status</span>
                  <Badge variant={p.paymentStatus === "paid" ? "default" : "outline"} className="mt-0.5">
                    {p.paymentStatus || "pending"}
                  </Badge>
                </div>
                {p.zohoInvoiceId && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Zoho Invoice ID</span>
                    <p className="font-mono text-xs">{p.zohoInvoiceId}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                <Calendar className="h-3.5 w-3.5" /> Dates
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Pickup Date</span>
                  <p>{p.pickUpDate ? new Date(p.pickUpDate).toLocaleDateString() : "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Due Date</span>
                  <p>{p.paymentDueDate ? new Date(p.paymentDueDate).toLocaleDateString() : "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created</span>
                  <p>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</p>
                </div>
              </div>
            </div>

            {/* Photos */}
            {(() => {
              const photo1 = resolvePhotoUrl(p.firstPhotoUrl, p.firstPhoto);
              const photo2 = resolvePhotoUrl(p.secondPhotoUrl, p.secondPhoto);
              if (!photo1 && !photo2) return null;
              return (
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    <Camera className="h-3.5 w-3.5" /> Photos
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {photo1 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Before / Photo 1</p>
                        {photoError['photo1'] ? (
                          <div className="rounded border bg-muted flex items-center justify-center h-32 text-xs text-muted-foreground">
                            Failed to load
                          </div>
                        ) : (
                          <a href={photo1} target="_blank" rel="noopener noreferrer">
                            <img
                              src={photo1}
                              alt="Pickup photo 1"
                              className="rounded border w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onError={() => setPhotoError(prev => ({ ...prev, photo1: true }))}
                            />
                          </a>
                        )}
                      </div>
                    )}
                    {photo2 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">After / Photo 2</p>
                        {photoError['photo2'] ? (
                          <div className="rounded border bg-muted flex items-center justify-center h-32 text-xs text-muted-foreground">
                            Failed to load
                          </div>
                        ) : (
                          <a href={photo2} target="_blank" rel="noopener noreferrer">
                            <img
                              src={photo2}
                              alt="Pickup photo 2"
                              className="rounded border w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onError={() => setPhotoError(prev => ({ ...prev, photo2: true }))}
                            />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Click a photo to open full size</p>
                </div>
              );
            })()}

            {p.incidentReport && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">Incidence Report</p>
                <p className="text-amber-900">{p.incidentReport}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
