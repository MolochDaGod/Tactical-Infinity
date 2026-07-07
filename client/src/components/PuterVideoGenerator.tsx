import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Download, Play, RefreshCw, Loader2, Film, Check } from 'lucide-react';

const INTRO_VIDEO_PROMPTS = [
  {
    id: 'orc_chains_wide',
    name: 'Wide Shot - Orcs in Chains',
    prompt: 'Cinematic wide shot of a medieval slave ship deck in a violent storm at night, six muscular green orcs chained together in iron shackles sitting on wooden planks, heavy rain pouring down, waves crashing against the ship, lightning illuminating their desperate faces, dark fantasy style, gritty realistic, 4k cinematic'
  },
  {
    id: 'orc_row_pan',
    name: 'Slow Pan - Row of Orcs',
    prompt: 'Slow cinematic camera pan across a row of chained orc prisoners on a storm-tossed ship deck, close-up tracking shot moving past each face, rain streaming down their green skin, tusks and war scars visible, chains rattling, lightning flashes, dark atmospheric fantasy, dramatic lighting, movie quality'
  },
  {
    id: 'young_orc_eyes',
    name: 'Close-up - Young Orc Eyes',
    prompt: 'Extreme close-up of a young orc child face, green skin wet from rain, yellow glowing eyes filled with fear and determination, water droplets on tusks, iron collar around neck, storm lightning reflection in eyes, dark cinematic fantasy, emotional, high detail, 4k'
  },
  {
    id: 'tentacle_reveal',
    name: 'Tentacle Behind Shoulder',
    prompt: 'Dramatic reveal shot of massive purple kraken tentacle rising behind a young orc prisoner on a ship deck, tentacle covered in glowing bioluminescent patterns, orc looking forward unaware, storm raging, waves and rain, horror fantasy atmosphere, cinematic lighting, dark dramatic'
  },
  {
    id: 'storm_ship',
    name: 'Ship in Storm (Establishing)',
    prompt: 'Epic establishing shot of a wooden pirate slave ship being tossed by massive waves in a violent night storm, black sails torn by wind, lightning strikes illuminating dark clouds, dramatic ocean swells, fantasy sea, cinematic movie quality, dark atmosphere, 4k'
  },
  {
    id: 'chains_detail',
    name: 'Chains and Rain Detail',
    prompt: 'Macro close-up of iron chains and shackles on green orc wrists, rain water streaming down rusted metal, lightning flash illuminating the texture, wooden ship deck visible, dark moody atmosphere, fantasy medieval, hyper detailed, cinematic'
  }
];

interface GeneratedVideo {
  id: string;
  name: string;
  prompt: string;
  videoUrl?: string;
  status: 'pending' | 'generating' | 'complete' | 'error';
  error?: string;
}

export default function PuterVideoGenerator() {
  const [videos, setVideos] = useState<GeneratedVideo[]>(
    INTRO_VIDEO_PROMPTS.map(p => ({ ...p, status: 'pending' as const }))
  );
  const [currentlyGenerating, setCurrentlyGenerating] = useState<string | null>(null);
  const [puterLoaded, setPuterLoaded] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.puter.com/v2/';
    script.async = true;
    script.onload = () => {
      setPuterLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const generateVideo = async (videoId: string) => {
    const puter = (window as any).puter;
    if (!puterLoaded || !puter) {
      console.error('Puter.js not loaded');
      return;
    }

    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    setCurrentlyGenerating(videoId);
    setElapsedTime(0);
    
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 0.1);
    }, 100);

    setVideos(prev => prev.map(v => 
      v.id === videoId ? { ...v, status: 'generating' as const } : v
    ));

    try {
      const videoElement = await puter.ai.txt2vid(video.prompt, {
        model: 'ByteDance/Seedance-1.0-pro',
        width: 864,
        height: 480
      });

      const videoBlob = await fetch(videoElement.src).then(r => r.blob());
      const videoUrl = URL.createObjectURL(videoBlob);

      setVideos(prev => prev.map(v => 
        v.id === videoId ? { ...v, status: 'complete' as const, videoUrl } : v
      ));
    } catch (error) {
      console.error('Video generation error:', error);
      setVideos(prev => prev.map(v => 
        v.id === videoId ? { 
          ...v, 
          status: 'error' as const, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        } : v
      ));
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setCurrentlyGenerating(null);
    }
  };

  const generateAllVideos = async () => {
    for (const video of videos) {
      if (video.status !== 'complete') {
        await generateVideo(video.id);
      }
    }
  };

  const downloadVideo = (videoUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `${filename}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const completedCount = videos.filter(v => v.status === 'complete').length;
  const progress = (completedCount / videos.length) * 100;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">Intro Video Generator</h1>
            <p className="text-muted-foreground mt-1">Generate cinematic intro videos using Puter AI</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {completedCount}/{videos.length} complete
            </div>
            <Button
              onClick={generateAllVideos}
              disabled={!puterLoaded || currentlyGenerating !== null}
              className="gap-2"
              data-testid="button-generate-all"
            >
              {currentlyGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Film className="w-4 h-4" />
                  Generate All
                </>
              )}
            </Button>
          </div>
        </div>

        <Progress value={progress} className="h-2" />

        {!puterLoaded && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardContent className="p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
              <span className="text-amber-200">Loading Puter.js AI library...</span>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <Card 
              key={video.id} 
              className={`transition-all ${
                video.status === 'complete' ? 'border-green-500/50' : 
                video.status === 'generating' ? 'border-amber-500/50' :
                video.status === 'error' ? 'border-red-500/50' : ''
              }`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="truncate">{video.name}</span>
                  {video.status === 'complete' && <Check className="w-5 h-5 text-green-500" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {video.videoUrl ? (
                  <div className="relative aspect-video bg-black rounded-md overflow-hidden">
                    <video
                      src={video.videoUrl}
                      className="w-full h-full object-cover"
                      controls
                      loop
                      muted
                      data-testid={`video-${video.id}`}
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-muted/30 rounded-md flex items-center justify-center">
                    {video.status === 'generating' ? (
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Generating... ({elapsedTime.toFixed(1)}s)
                        </p>
                      </div>
                    ) : video.status === 'error' ? (
                      <p className="text-sm text-red-400 px-4 text-center">{video.error}</p>
                    ) : (
                      <Film className="w-12 h-12 text-muted-foreground/30" />
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground line-clamp-3">
                  {video.prompt}
                </p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={video.status === 'complete' ? 'outline' : 'default'}
                    onClick={() => generateVideo(video.id)}
                    disabled={!puterLoaded || currentlyGenerating !== null}
                    className="flex-1 gap-1"
                    data-testid={`button-generate-${video.id}`}
                  >
                    {video.status === 'generating' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : video.status === 'complete' ? (
                      <RefreshCw className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    {video.status === 'complete' ? 'Regenerate' : 'Generate'}
                  </Button>
                  
                  {video.videoUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadVideo(video.videoUrl!, video.id)}
                      className="gap-1"
                      data-testid={`button-download-${video.id}`}
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-muted/20">
          <CardHeader>
            <CardTitle className="text-lg">Scene Sequence for Intro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong>1.</strong> Storm Ship (Establishing) - 1.5s</p>
            <p><strong>2.</strong> Wide Shot - Orcs in Chains - 1.5s</p>
            <p><strong>3.</strong> Slow Pan - Row of Orcs - 2s</p>
            <p><strong>4.</strong> Chains and Rain Detail - 1s (insert)</p>
            <p><strong>5.</strong> Close-up - Young Orc Eyes - 1.5s</p>
            <p><strong>6.</strong> Tentacle Behind Shoulder - 1s → transition to WebGL scene</p>
            <p className="text-xs text-muted-foreground/70 mt-3">
              Total intro video: ~8.5 seconds → WebGL cinematic continues
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
