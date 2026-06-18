import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, MapPin, Building2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Lot {
  id: string;
  lotCode: string;
  lotName: string;
  paytWebhook: string;
  monthlyWebhook: string;
  companyId: string;
  companyName: string;
}

interface SelectedLot {
  lotCode: string;
  lotName: string;
  paytWebhook: string;
  monthlyWebhook: string;
}

interface LotSelectorProps {
  selectedLots: SelectedLot[];
  onLotsChange: (lots: SelectedLot[]) => void;
}

export function LotSelector({ selectedLots, onLotsChange }: LotSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // lots.list returns { lots: [...], totalCount: N, ... } — unwrap the array
  const { data: lotsResponse, isLoading } = trpc.lots.list.useQuery(undefined);
  const availableLots: Lot[] = Array.isArray(lotsResponse)
    ? lotsResponse
    : Array.isArray((lotsResponse as any)?.lots)
      ? (lotsResponse as any).lots
      : [];

  const filteredLots = useMemo(() => {
    if (!searchQuery) return availableLots;
    const query = searchQuery.toLowerCase();
    return availableLots.filter((lot: Lot) =>
      lot.lotCode.toLowerCase().includes(query) ||
      lot.lotName.toLowerCase().includes(query) ||
      lot.companyName.toLowerCase().includes(query)
    );
  }, [availableLots, searchQuery]);

  const handleSelectLot = (lot: Lot) => {
    // Avoid duplicates
    if (selectedLots.some((s) => s.lotCode === lot.lotCode)) return;
    const newLot: SelectedLot = {
      lotCode: lot.lotCode,
      lotName: lot.lotName,
      paytWebhook: lot.paytWebhook || "",
      monthlyWebhook: lot.monthlyWebhook || "",
    };
    onLotsChange([...selectedLots, newLot]);
    setSearchQuery("");
    setShowDropdown(false);
  };

  const handleRemoveLot = (index: number) => {
    onLotsChange(selectedLots.filter((_, i) => i !== index));
  };

  const handleWebhookChange = (
    index: number,
    field: "paytWebhook" | "monthlyWebhook",
    value: string
  ) => {
    const updated = [...selectedLots];
    updated[index][field] = value;
    onLotsChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Search & Add Operational Lots</Label>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Lot ID, ward name, company, or LGA..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            className="pl-10"
          />

          {showDropdown && searchQuery && (
            <Card className="absolute z-50 w-full mt-2 max-h-[300px] overflow-y-auto shadow-lg">
              <CardContent className="p-2">
                {isLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Loading lots...
                  </div>
                ) : filteredLots.length > 0 ? (
                  <div className="space-y-1">
                    {filteredLots.map((lot: Lot) => (
                      <button
                        key={lot.id}
                        type="button"
                        onMouseDown={() => handleSelectLot(lot)}
                        className="w-full text-left p-3 hover:bg-accent rounded-md transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="font-mono">
                                {lot.lotCode}
                              </Badge>
                            </div>
                            <div className="text-sm font-medium truncate">
                              {lot.lotName}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {lot.companyName}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No lots found matching &quot;{searchQuery}&quot;
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {availableLots.length} active operational lots available
        </p>
      </div>

      {selectedLots.length > 0 && (
        <div className="space-y-3">
          <Label>Selected Lots ({selectedLots.length})</Label>
          {selectedLots.map((lot, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant="outline">{lot.lotCode}</Badge>
                    {lot.lotName}
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveLot(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor={`paytWebhook_${index}`}>PAYT Webhook URL</Label>
                  <Input
                    id={`paytWebhook_${index}`}
                    value={lot.paytWebhook}
                    onChange={(e) =>
                      handleWebhookChange(index, "paytWebhook", e.target.value)
                    }
                    placeholder="https://..."
                    required
                  />
                </div>
                <div>
                  <Label htmlFor={`monthlyWebhook_${index}`}>Monthly Webhook URL</Label>
                  <Input
                    id={`monthlyWebhook_${index}`}
                    value={lot.monthlyWebhook}
                    onChange={(e) =>
                      handleWebhookChange(index, "monthlyWebhook", e.target.value)
                    }
                    placeholder="https://..."
                    required
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
