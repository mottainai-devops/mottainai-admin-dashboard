import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, Package, MapPin, Calendar, CreditCard, User } from "lucide-react";

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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
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
                <div><span className="text-muted-foreground">Building ID</span><p className="font-mono font-medium">{(pickup as any).buildingId || "—"}</p></div>
                <div><span className="text-muted-foreground">Lot Code</span><p className="font-mono">{(pickup as any).lotCode || "—"}</p></div>
                <div><span className="text-muted-foreground">LGA</span><p>{(pickup as any).lgaName || "—"}</p></div>
                <div><span className="text-muted-foreground">Ward</span><p>{(pickup as any).wardName || "—"}</p></div>
                <div><span className="text-muted-foreground">State Code</span><p>{(pickup as any).stateCode || "—"}</p></div>
                <div><span className="text-muted-foreground">Country</span><p>{(pickup as any).country || "—"}</p></div>
              </div>
            </div>

            {/* Customer */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                <User className="h-3.5 w-3.5" /> Customer
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Name</span><p>{(pickup as any).fullName || "—"}</p></div>
                <div><span className="text-muted-foreground">Phone</span><p>{(pickup as any).phoneNumber || "—"}</p></div>
                <div><span className="text-muted-foreground">Type</span><p className="capitalize">{(pickup as any).customerType || "—"}</p></div>
                <div><span className="text-muted-foreground">Bin Type</span><p>{(pickup as any).binType || "—"}</p></div>
              </div>
            </div>

            {/* Billing */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                <CreditCard className="h-3.5 w-3.5" /> Billing
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Amount</span><p className="font-semibold">₦{((pickup as any).totalDue || 0).toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Bin Qty</span><p>{(pickup as any).binQtyPerPickup || 1}</p></div>
                <div><span className="text-muted-foreground">Payment Type</span>
                  <Badge variant={(pickup as any).paymentType === "monthly" ? "default" : "secondary"} className="mt-0.5">
                    {(pickup as any).paymentType || "—"}
                  </Badge>
                </div>
                <div><span className="text-muted-foreground">Status</span>
                  <Badge variant={(pickup as any).paymentStatus === "paid" ? "default" : "outline"} className="mt-0.5">
                    {(pickup as any).paymentStatus || "pending"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                <Calendar className="h-3.5 w-3.5" /> Dates
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Pickup Date</span><p>{(pickup as any).pickUpDate ? new Date((pickup as any).pickUpDate).toLocaleDateString() : "—"}</p></div>
                <div><span className="text-muted-foreground">Due Date</span><p>{(pickup as any).paymentDueDate ? new Date((pickup as any).paymentDueDate).toLocaleDateString() : "—"}</p></div>
                <div><span className="text-muted-foreground">Created</span><p>{(pickup as any).createdAt ? new Date((pickup as any).createdAt).toLocaleDateString() : "—"}</p></div>
              </div>
            </div>

            {(pickup as any).incidentReport && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">Incidence Report</p>
                <p className="text-amber-900">{(pickup as any).incidentReport}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
