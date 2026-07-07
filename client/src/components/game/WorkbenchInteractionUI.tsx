import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ProfessionWorkbench } from '@/data/assetManifest';
import { WorkbenchInteractionState } from '@/lib/workbenchSystem';
import { Sparkles, Axe, Pickaxe, Wrench, ChefHat, X, Users, Package, Settings } from 'lucide-react';

interface WorkbenchInteractionUIProps {
  interactionState: WorkbenchInteractionState;
  onCloseModal: () => void;
  onQuickAction?: (workbench: ProfessionWorkbench) => void;
  onAssignAllies?: (workbench: ProfessionWorkbench) => void;
  onOpenInventory?: (workbench: ProfessionWorkbench) => void;
  onConfigure?: (workbench: ProfessionWorkbench) => void;
}

const PROFESSION_ICONS: Record<string, typeof Sparkles> = {
  mystic: Sparkles,
  forester: Axe,
  miner: Pickaxe,
  engineer: Wrench,
  chef: ChefHat,
};

const PROFESSION_COLORS: Record<string, string> = {
  mystic: 'text-purple-400 bg-purple-400/20',
  forester: 'text-green-400 bg-green-400/20',
  miner: 'text-amber-400 bg-amber-400/20',
  engineer: 'text-blue-400 bg-blue-400/20',
  chef: 'text-orange-400 bg-orange-400/20',
};

export function WorkbenchInteractionUI({
  interactionState,
  onCloseModal,
  onQuickAction,
  onAssignAllies,
  onOpenInventory,
  onConfigure,
}: WorkbenchInteractionUIProps) {
  const { nearestWorkbench, activeWorkbench, isInRange, holdProgress, isModalOpen } = interactionState;
  
  const modalWorkbench = isModalOpen ? activeWorkbench : null;
  const promptWorkbench = isInRange ? nearestWorkbench : null;
  
  if (!modalWorkbench && !promptWorkbench) return null;
  
  const workbenchInstance = modalWorkbench || promptWorkbench;
  if (!workbenchInstance) return null;
  
  const workbench = workbenchInstance.workbench;
  const Icon = PROFESSION_ICONS[workbench.profession] || Sparkles;
  const colorClass = PROFESSION_COLORS[workbench.profession] || 'text-white bg-white/20';
  
  return (
    <>
      {!isModalOpen && (
        <div 
          className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-50"
          data-testid="workbench-prompt"
        >
          <Card className="bg-black/80 border-amber-600/50">
            <CardContent className="p-4 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-full ${colorClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-white font-semibold" data-testid="text-workbench-name">{workbench.name}</span>
              </div>
              
              <div className="text-sm text-white/70 text-center max-w-xs" data-testid="text-workbench-description">
                {workbench.description}
              </div>
              
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-amber-400 border-amber-400/50" data-testid="badge-interact-key">
                  F
                </Badge>
                <span className="text-white/80 text-sm" data-testid="text-craft-hint">Craft</span>
                <span className="text-white/40 mx-2">|</span>
                <span className="text-white/60 text-xs" data-testid="text-hold-hint">Hold for options</span>
              </div>
              
              {holdProgress > 0 && (
                <div className="w-full mt-2">
                  <Progress value={holdProgress * 100} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && onCloseModal()}>
        <DialogContent 
          className="bg-gray-900/95 border-amber-600/50 max-w-md"
          data-testid="workbench-modal"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${colorClass}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <div className="text-white">{workbench.name}</div>
                <div className="text-xs text-white/60 font-normal capitalize">
                  {workbench.profession} Profession
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="text-sm text-white/70">{workbench.description}</div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center gap-1 p-3 border rounded-md">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => onQuickAction?.(workbench)}
                  data-testid="button-craft"
                >
                  <Package className="w-5 h-5 text-amber-400" />
                </Button>
                <span className="text-xs text-white/80" data-testid="text-craft-label">Open Crafting</span>
              </div>
              
              <div className="flex flex-col items-center gap-1 p-3 border rounded-md">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => onAssignAllies?.(workbench)}
                  data-testid="button-assign-allies"
                >
                  <Users className="w-5 h-5 text-blue-400" />
                </Button>
                <span className="text-xs text-white/80" data-testid="text-allies-label">Assign Allies</span>
              </div>
              
              <div className="flex flex-col items-center gap-1 p-3 border rounded-md">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => onOpenInventory?.(workbench)}
                  data-testid="button-inventory"
                >
                  <Package className="w-5 h-5 text-green-400" />
                </Button>
                <span className="text-xs text-white/80" data-testid="text-inventory-label">View Inventory</span>
              </div>
              
              <div className="flex flex-col items-center gap-1 p-3 border rounded-md">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => onConfigure?.(workbench)}
                  data-testid="button-configure"
                >
                  <Settings className="w-5 h-5 text-gray-400" />
                </Button>
                <span className="text-xs text-white/80" data-testid="text-configure-label">Configure</span>
              </div>
            </div>
            
            <div className="border-t border-white/10 pt-4">
              <div className="text-xs text-white/50 mb-2" data-testid="text-recipes-label">Available Recipes:</div>
              <div className="flex flex-wrap gap-1" data-testid="container-recipes">
                {workbench.recipes.map((recipe) => (
                  <Badge
                    key={recipe}
                    variant="secondary"
                    className="text-xs capitalize"
                    data-testid={`badge-recipe-${recipe}`}
                  >
                    {recipe.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            onClick={onCloseModal}
            data-testid="button-close-modal"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
