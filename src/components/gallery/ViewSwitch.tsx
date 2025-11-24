import { useState } from "react";
import { GalleryHorizontal, List } from "lucide-react";

import { Button } from "@/components/ui/button";

export type View = "photowall" | "detail";

interface ViewSwitchProps {
  onViewChange: (view: View) => void;
}

export function ViewSwitch({ onViewChange }: ViewSwitchProps) {
  const [activeView, setActiveView] = useState<View>("photowall");

  const handleViewChange = (view: View) => {
    setActiveView(view);
    onViewChange(view);
  };

  return (
    <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1 *:cursor-pointer">
      <Button
        variant={activeView === "photowall" ? "secondary" : "ghost"}
        className={activeView==='photowall'?'bg-white text-blue-600': ""}
        size="icon"
        onClick={() => handleViewChange("photowall")}
      >
        <GalleryHorizontal />
      </Button>
      <Button
        variant={activeView === "detail" ? "secondary" : "ghost"}
        className={activeView==='detail'?'bg-white text-blue-600': ""}
        size="icon"
        onClick={() => handleViewChange("detail")}
      >
        <List />
      </Button>
    </div>
  );
}
