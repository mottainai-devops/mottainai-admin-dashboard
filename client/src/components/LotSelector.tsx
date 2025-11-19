import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, MapPin, Building2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Lot {
  OBJECTID: number;
  lga_code: number;
  ward_name: string;
  ward_code: string;
  Lot_ID: number;
  socio_economic_groups: string;
  lga_name: string;
  state_code: string;
  state_name: string;
  Business_Name: string;
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
  
  const { data: availableLots, isLoading } = trpc.lots.list.useQuery();
  
  const filteredLots = useMemo(() => {
    if (!availableLots || !searchQuery) return availableLots || [];
    
    const query = searchQuery.toLowerCase();
    return availableLots.filter((lot: Lot) =>
      lot.Lot_ID.toString().includes(query) ||
      lot.ward_name.toLowerCase().includes(query) ||
      lot.Business_Name.toLowerCase().includes(query) ||
      lot.lga_name.toLowerCase().includes(query)
    );
  }, [availableLots, searchQuery]);
  
  const handleSelectLot = (lot: Lot) => {
    const newLot: SelectedLot = {
      lotCode: `LOT-${lot.Lot_ID}`,
      lotName: `${lot.ward_name} (${lot.lga_name})`,
      paytWebhook: "",
      monthlyWebhook: "",
    };
    
    onLotsChange([...selectedLots, newLot]);
    setSearchQuery("");
    setShowDropdown(false);
  };
  
  const handleRemoveLot = (index: number) => {
    onLotsChange(selectedLots.filter((_, i) => i !== index));
  };
  
  const handleWebhookChange = (index: number, field: "paytWebhook" | "monthlyWebhook", value: string) => {
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
            className="pl-10"
          />
          
          {showDropdown && searchQuery && (
            <Card className="absolute z-50 w-full mt-2 max-h-[300px] overflow-y-auto">
              <CardContent className="p-2">
                {isLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Loading lots...
                  </div>
                ) : filteredLots && filteredLots.length > 0 ? (
                  <div className="space-y-1">
                    {filteredLots.map((lot: Lot) => (
                      <button
                        key={lot.OBJECTID}
                        type="button"
                        onClick={() => handleSelectLot(lot)}
                        className="w-full text-left p-3 hover:bg-accent rounded-md transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="font-mono">
                                LOT-{lot.Lot_ID}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {lot.socio_economic_groups}
                              </Badge>
                            </div>
                            <div className="text-sm font-medium truncate">
                              {lot.ward_name}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {lot.lga_name}, {lot.state_name}
                              </span>
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {lot.Business_Name}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No lots found matching "{searchQuery}"
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {availableLots?.length || 0} active operational lots available
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
                    onChange={(e) => handleWebhookChange(index, "paytWebhook", e.target.value)}
                    placeholder="https://..."
                    required
                  />
                </div>
                <div>
                  <Label htmlFor={`monthlyWebhook_${index}`}>Monthly Webhook URL</Label>
                  <Input
                    id={`monthlyWebhook_${index}`}
                    value={lot.monthlyWebhook}
                    onChange={(e) => handleWebhookChange(index, "monthlyWebhook", e.target.value)}
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
