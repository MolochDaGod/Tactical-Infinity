import { useState, useCallback, useEffect } from 'react';

interface MeshyTask {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  progress: number;
  model_urls?: {
    glb?: string;
    fbx?: string;
    obj?: string;
    usdz?: string;
  };
  thumbnail_url?: string;
}

interface GenerateOptions {
  prompt: string;
  artStyle?: 'realistic' | 'sculpture' | 'pbr' | 'cartoon';
  negativePrompt?: string;
}

interface MeshyStatus {
  configured: boolean;
  message: string;
}

export function useMeshyModels() {
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTask, setCurrentTask] = useState<MeshyTask | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    checkMeshyStatus();
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [pollingInterval]);

  const checkMeshyStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/meshy/status');
      const data: MeshyStatus = await response.json();
      setIsConfigured(data.configured);
    } catch {
      setIsConfigured(false);
    }
  }, []);

  const pollTask = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`/api/meshy/task/${taskId}`);
      const task: MeshyTask = await response.json();
      setCurrentTask(task);

      if (task.status === 'SUCCEEDED' || task.status === 'FAILED' || task.status === 'EXPIRED') {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        setIsLoading(false);
        
        if (task.status === 'FAILED' || task.status === 'EXPIRED') {
          setError(`Model generation ${task.status.toLowerCase()}`);
        }
      }
      
      return task;
    } catch (err) {
      setError('Failed to poll task status');
      setIsLoading(false);
      return null;
    }
  }, [pollingInterval]);

  const startPolling = useCallback((taskId: string) => {
    if (pollingInterval) clearInterval(pollingInterval);
    
    const interval = setInterval(() => {
      pollTask(taskId);
    }, 5000);
    
    setPollingInterval(interval);
    pollTask(taskId);
  }, [pollTask, pollingInterval]);

  const generateCustomModel = useCallback(async (options: GenerateOptions) => {
    if (!isConfigured) {
      setError('Meshy API not configured');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setCurrentTask(null);

    try {
      const response = await fetch('/api/meshy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      const data = await response.json();
      
      if (data.taskId) {
        startPolling(data.taskId);
        return data.taskId;
      }
      
      throw new Error('No task ID returned');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation');
      setIsLoading(false);
      return null;
    }
  }, [isConfigured, startPolling]);

  const generateShipModel = useCallback(async (shipType: string = 'sloop') => {
    if (!isConfigured) {
      setError('Meshy API not configured');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setCurrentTask(null);

    try {
      const response = await fetch('/api/meshy/generate-ship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipType }),
      });
      const data = await response.json();
      
      if (data.taskId) {
        startPolling(data.taskId);
        return data.taskId;
      }
      
      throw new Error('No task ID returned');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start ship generation');
      setIsLoading(false);
      return null;
    }
  }, [isConfigured, startPolling]);

  const generateSailModel = useCallback(async () => {
    if (!isConfigured) {
      setError('Meshy API not configured');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setCurrentTask(null);

    try {
      const response = await fetch('/api/meshy/generate-sail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      
      if (data.taskId) {
        startPolling(data.taskId);
        return data.taskId;
      }
      
      throw new Error('No task ID returned');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start sail generation');
      setIsLoading(false);
      return null;
    }
  }, [isConfigured, startPolling]);

  const refineModel = useCallback(async (previewTaskId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meshy/refine/${previewTaskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      
      if (data.refineTaskId) {
        startPolling(data.refineTaskId);
        return data.refineTaskId;
      }
      
      throw new Error('No refine task ID returned');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start refinement');
      setIsLoading(false);
      return null;
    }
  }, [startPolling]);

  const cancelPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setIsLoading(false);
  }, [pollingInterval]);

  return {
    isConfigured,
    isLoading,
    error,
    currentTask,
    progress: currentTask?.progress ?? 0,
    modelUrl: currentTask?.model_urls?.glb,
    thumbnailUrl: currentTask?.thumbnail_url,
    generateCustomModel,
    generateShipModel,
    generateSailModel,
    refineModel,
    cancelPolling,
    checkMeshyStatus,
  };
}

export function useShipTypes() {
  const [shipTypes, setShipTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/meshy/ship-types')
      .then(res => res.json())
      .then(data => {
        setShipTypes(data.shipTypes || []);
        setIsLoading(false);
      })
      .catch(() => {
        setShipTypes(['raft', 'skiff', 'sloop', 'brigantine', 'galleon']);
        setIsLoading(false);
      });
  }, []);

  return { shipTypes, isLoading };
}
