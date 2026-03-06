import { useState } from "react";
import { WorldMapScene } from "@/components/WorldMap/WorldMapScene";

interface LandedIsland {
  id: string;
  name: string;
  biome: string;
  radius: number;
  hasPort: boolean;
  isOwned: boolean;
  resources: string[];
}

export default function WorldMapPage() {
  const [landedIsland, setLandedIsland] = useState<LandedIsland | null>(null);

  const handleLandOnIsland = (islandId: string) => {
    setLandedIsland({
      id: islandId,
      name: `Island ${islandId.split('-')[1]}`,
      biome: 'tropical',
      radius: 50,
      hasPort: Math.random() > 0.5,
      isOwned: false,
      resources: ['wood', 'stone', 'fish']
    });
  };

  const handleReturnToSea = () => {
    setLandedIsland(null);
  };

  if (landedIsland) {
    return (
      <div className="w-full h-screen bg-background flex flex-col" data-testid="page-island-view">
        <div className="bg-card border-b p-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold" data-testid="text-island-name">{landedIsland.name}</h1>
            <p className="text-sm text-muted-foreground">
              {landedIsland.biome.charAt(0).toUpperCase() + landedIsland.biome.slice(1)} Island
              {landedIsland.hasPort && " - Has Port"}
            </p>
          </div>
          <button
            onClick={handleReturnToSea}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
            data-testid="button-return-to-sea"
          >
            Return to Sea
          </button>
        </div>
        
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-card rounded-lg p-6 border" data-testid="panel-island-info">
              <h2 className="text-lg font-semibold mb-4">Island Information</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Biome:</span>
                  <span className="ml-2 font-medium capitalize">{landedIsland.biome}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <span className="ml-2 font-medium">
                    {landedIsland.isOwned ? "Owned" : "Unclaimed"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Port:</span>
                  <span className="ml-2 font-medium">{landedIsland.hasPort ? "Available" : "None"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Size:</span>
                  <span className="ml-2 font-medium">{Math.round(landedIsland.radius * 2)}m</span>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border" data-testid="panel-resources">
              <h2 className="text-lg font-semibold mb-4">Available Resources</h2>
              <div className="flex flex-wrap gap-2">
                {landedIsland.resources.map((resource, i) => (
                  <span
                    key={i}
                    className="bg-secondary text-secondary-foreground px-3 py-1 rounded-md text-sm capitalize"
                  >
                    {resource}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border" data-testid="panel-actions">
              <h2 className="text-lg font-semibold mb-4">Actions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <button 
                  className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md transition-colors text-sm"
                  data-testid="button-deploy-harvesters"
                >
                  Deploy Harvesters
                </button>
                <button 
                  className="bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-md transition-colors text-sm"
                  data-testid="button-explore"
                >
                  Explore Island
                </button>
                {landedIsland.hasPort && (
                  <button 
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors text-sm"
                    data-testid="button-trade"
                  >
                    Trade at Port
                  </button>
                )}
                {!landedIsland.isOwned && (
                  <button 
                    className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-md transition-colors text-sm"
                    data-testid="button-claim"
                  >
                    Claim Island
                  </button>
                )}
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-center text-muted-foreground text-sm">
              3D Harvesting mode coming soon - Deploy your units to gather resources!
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen" data-testid="page-world-map">
      <WorldMapScene 
        onLandOnIsland={handleLandOnIsland}
        onBackToMenu={() => window.history.back()}
      />
    </div>
  );
}
